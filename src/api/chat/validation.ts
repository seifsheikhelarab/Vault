import { z } from 'zod'

/**
 * Zod schema for the chat parse endpoint (ticket #12). Validation failures
 * flow through the shared zValidator hook into the central 422 envelope.
 */
export const parseMessageSchema = z.object({
  message: z.string().trim().min(1).max(1000),
})
