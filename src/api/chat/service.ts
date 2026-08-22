import { GoogleGenAI, Type } from '@google/genai'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'
import type { PrismaClient } from '../../generated/prisma/client'

/**
 * Chat parsing service (ticket #12). Turns a free-text message into an
 * expense DRAFT via Gemini structured output; the server never saves an
 * expense — confirmation goes through the normal expense-create path.
 */

/** Draft sent back to the client: model fields plus the resolved category id. */
export type ExpenseDraft = {
  amountMinor: number | null
  currency: 'EGP'
  categoryGuess: string | null
  categoryId: string | null
  occurredAtGuess: string | null
  note: string | null
}

/**
 * The project-wide mock seam (ticket #12): tests stub exactly this function
 * via binding injection; every other layer runs for real. Returns RAW model
 * output — validation happens at the trust boundary in parseExpenseDraft.
 */
export type ParseExpense = (message: string, now: Date) => Promise<unknown>

/** Shape Gemini's responseSchema forces; anything else is malformed. */
const modelDraftSchema = z.object({
  amountMinor: z.int().nullable(),
  currency: z.literal('EGP'),
  categoryGuess: z.string().nullish(),
  occurredAtGuess: z.union([z.iso.date(), z.iso.datetime()]).nullish(),
  note: z.string().nullish(),
})

function upstreamError(): HTTPException {
  return new HTTPException(502, { message: 'Expense parsing failed upstream' })
}

/**
 * Validate raw parser output, then resolve categoryGuess against the user's
 * categories case-insensitively → categoryId|null. Malformed output — thrown
 * parser errors, unparseable JSON, wrong shapes — becomes a 502 envelope.
 */
export async function parseExpenseDraft(
  db: PrismaClient,
  userId: string,
  message: string,
  now: Date,
  parse: ParseExpense,
): Promise<ExpenseDraft> {
  let raw: unknown
  try {
    raw = await parse(message, now)
  } catch (error) {
    console.error('chat parser threw', error)
    throw upstreamError()
  }

  const result = modelDraftSchema.safeParse(raw)
  if (!result.success) {
    console.error('chat parser returned malformed draft', z.treeifyError(result.error))
    throw upstreamError()
  }
  const draft = result.data

  let categoryId: string | null = null
  if (draft.categoryGuess != null) {
    const guess = draft.categoryGuess.trim()
    if (guess !== '') {
      const match = await db.category.findFirst({
        where: { userId, name: { equals: guess, mode: 'insensitive' } },
        select: { id: true },
      })
      categoryId = match?.id ?? null
    }
  }

  return {
    amountMinor: draft.amountMinor,
    currency: 'EGP',
    categoryGuess: draft.categoryGuess?.trim() || null,
    categoryId,
    occurredAtGuess: draft.occurredAtGuess ?? null,
    note: draft.note ?? null,
  }
}

/**
 * Production parser: gemini-2.5-flash with structured output. Constructed
 * lazily per request from the GEMINI_API_KEY binding — Workers env only
 * exists per-request, so nothing touches module-level state.
 */
export function createGeminiParser(apiKey: string): ParseExpense {
  const ai = new GoogleGenAI({ apiKey })

  return async (message, now) => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Today is ${now.toISOString().slice(0, 10)} (Africa/Cairo). Parse this expense message: "${message}"`,
      config: {
        systemInstruction:
          'Extract one expense draft from the user message. amountMinor is integer minor units ' +
          '(EGP piasters = amount * 100). occurredAtGuess is an ISO date (YYYY-MM-DD); resolve ' +
          'relative days like "yesterday" against today. categoryGuess is a plain category name, ' +
          'never an id. Return null for unknown fields.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amountMinor: { type: Type.INTEGER, nullable: true },
            currency: { type: Type.STRING, enum: ['EGP'] },
            categoryGuess: { type: Type.STRING, nullable: true },
            occurredAtGuess: { type: Type.STRING, nullable: true },
            note: { type: Type.STRING, nullable: true },
          },
          required: ['amountMinor', 'currency', 'categoryGuess', 'occurredAtGuess', 'note'],
        },
      },
    })
    // Empty text happens on safety blocks or MAX_TOKENS; both are upstream
    // failures and must surface as 502, never as a half-valid draft.
    if (!response.text) throw new Error('Gemini returned empty text')
    return JSON.parse(response.text) as unknown
  }
}
