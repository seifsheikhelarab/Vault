import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import api from './api'
import { onError } from './config/errors'
import type { AppBindings } from './config/env'
import { globalRateLimit, strictRateLimit } from './config/rate-limit'
import { createPrisma, resolveDatabaseUrl } from './config/prisma'
import { materializeDue } from './api/recurring/service'

const app = new Hono<{ Bindings: AppBindings }>()
app.use('/api/auth/*', strictRateLimit)
app.use('/api/chat/*', strictRateLimit)
app.use('/api/*', globalRateLimit)

app.route('/api', api)

app.notFound(() => {
  throw new HTTPException(404, { message: 'Not found' })
})

app.onError(onError)

export { app }

/**
 * Workers entry (spec #1): fetch serves the API; scheduled is the daily cron
 * (triggers.crons in wrangler.jsonc) — the only caller that passes the real
 * clock to materializeDue, iterating every user's due definitions.
 */
export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: AppBindings, ctx: ExecutionContext) {
    ctx.waitUntil(materializeDue(createPrisma(resolveDatabaseUrl(env)), new Date()))
  },
} satisfies ExportedHandler<AppBindings>
