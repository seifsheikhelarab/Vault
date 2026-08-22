import { HTTPException } from 'hono/http-exception'
import type { Context } from 'hono'
import type { AppEnv } from '../../config/env'
import { createGeminiParser, parseExpenseDraft } from './service'

/**
 * Chat controllers (ticket #12). The parser is resolved per request: either
 * injected via bindings (the test seam) or constructed lazily from the
 * GEMINI_API_KEY binding — never at module level, Workers env is per-request.
 * A missing key at runtime is an upstream failure → 502 envelope. The db and
 * session userId come from the api aggregator middleware / requireAuth.
 */
export async function parseMessageController(c: Context<AppEnv>, input: { message: string }) {
  const parse =
    c.env.parseExpense ??
    (c.env.GEMINI_API_KEY ? createGeminiParser(c.env.GEMINI_API_KEY) : null)
  if (!parse) throw new HTTPException(502, { message: 'Expense parser unavailable' })

  const draft = await parseExpenseDraft(
    c.get('db'),
    c.get('userId'),
    input.message,
    new Date(),
    parse,
  )
  return c.json(draft)
}
