import type { Context, ErrorHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod'

export type ErrorIssues = {
  formErrors: string[]
  fieldErrors: Record<string, string[]>
}

type Envelope = {
  error: { code: string; message: string; issues?: ErrorIssues }
}

const STATUS_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_ERROR',
} as const satisfies Record<number, string>

function envelope(code: string, message: string, issues?: ErrorIssues): Envelope {
  return { error: issues ? { code, message, issues } : { code, message } }
}

export function zodError(error: z.ZodError, c: Context): Response {
  const { formErrors, fieldErrors } = z.flattenError(error)
  return c.json(envelope('VALIDATION_ERROR', 'Invalid request', { formErrors, fieldErrors }), 422)
}

function defaultMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request'
    case 401:
      return 'Unauthorized'
    case 404:
      return 'Not found'
    case 409:
      return 'Conflict'
    case 422:
      return 'Validation error'
    default:
      return 'Error'
  }
}

export const onError: ErrorHandler<{ Bindings: CloudflareBindings }> = (err, c) => {
  if (err instanceof z.ZodError) return zodError(err, c)

  if (err instanceof HTTPException) {
    const status = err.status
    if (status >= 500) {
      console.error(err)
      return c.json(envelope('INTERNAL', 'Internal server error'), 500)
    }
    const code = STATUS_CODES[status as keyof typeof STATUS_CODES] ?? 'ERROR'
    const message = err.message || defaultMessage(status)
    return c.json(envelope(code, message), status)
  }

  console.error(err)
  return c.json(envelope('INTERNAL', 'Internal server error'), 500)
}
