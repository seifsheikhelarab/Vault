import { Hono } from 'hono'
import { requireAuth } from '../../config/auth'
import type { AppEnv } from '../../config/env'
import { pullController, pushController } from './controller'
import { pullQuerySchema, pushBatchSchema, validateJson, validateQuery } from './validation'

/**
 * Sync resource (ticket #13), mounted at /api/sync. Session-scoped via
 * requireAuth; errors flow through the central onError.
 */
const router = new Hono<AppEnv>()

router.use('*', requireAuth)

router.post('/push', validateJson(pushBatchSchema), (c) =>
  pushController(c, c.req.valid('json')),
)
router.get('/pull', validateQuery(pullQuerySchema), (c) =>
  pullController(c, c.req.valid('query')),
)

export default router
