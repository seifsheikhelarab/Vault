import { Hono } from 'hono'
import { requireAuth } from '../../config/auth'
import type { AppEnv } from '../../config/env'
import {
  createRecurringController,
  deleteRecurringController,
  getRecurringController,
  listRecurringController,
  updateRecurringController,
} from './controller'
import {
  createRecurringSchema,
  idParamSchema,
  updateRecurringSchema,
  validateJson,
  validateParam,
} from './validation'

/**
 * Recurring resource (ticket #9), mounted at /api/recurring. Pause/resume is
 * PATCH with the `paused` flag; materialization runs through the cron handler
 * in src/index.ts, not this router.
 */
const router = new Hono<AppEnv>()

router.use('*', requireAuth)

router.post('/', validateJson(createRecurringSchema), (c) =>
  createRecurringController(c, c.req.valid('json')),
)
router.get('/', (c) => listRecurringController(c))
router.get('/:id', validateParam(idParamSchema), (c) =>
  getRecurringController(c, c.req.valid('param').id),
)
router.patch(
  '/:id',
  validateParam(idParamSchema),
  validateJson(updateRecurringSchema),
  (c) => updateRecurringController(c, c.req.valid('param').id, c.req.valid('json')),
)
router.delete('/:id', validateParam(idParamSchema), (c) =>
  deleteRecurringController(c, c.req.valid('param').id),
)

export default router
