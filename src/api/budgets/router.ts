import { Hono } from 'hono'
import { requireAuth } from '../../config/auth'
import type { AppEnv } from '../../config/env'
import {
  budgetProgressController,
  createBudgetController,
  deleteBudgetController,
  getBudgetController,
  listBudgetsController,
  updateBudgetController,
} from './controller'
import {
  createBudgetSchema,
  idParamSchema,
  progressQuerySchema,
  updateBudgetSchema,
  validateJson,
  validateParam,
  validateQuery,
} from './validation'

/**
 * Budgets resource (ticket #8), mounted at /api/budgets. Session-scoped via
 * requireAuth; errors flow through the central onError. /progress registers
 * before /:id so "progress" is never eaten by the uuid param validator.
 */
const router = new Hono<AppEnv>()

router.use('*', requireAuth)

router.post('/', validateJson(createBudgetSchema), (c) =>
  createBudgetController(c, c.req.valid('json')),
)
router.get('/', (c) => listBudgetsController(c))
router.get('/progress', validateQuery(progressQuerySchema), (c) =>
  budgetProgressController(c, c.req.valid('query')),
)
router.get('/:id', validateParam(idParamSchema), (c) =>
  getBudgetController(c, c.req.valid('param').id),
)
router.patch(
  '/:id',
  validateParam(idParamSchema),
  validateJson(updateBudgetSchema),
  (c) => updateBudgetController(c, c.req.valid('param').id, c.req.valid('json')),
)
router.delete('/:id', validateParam(idParamSchema), (c) =>
  deleteBudgetController(c, c.req.valid('param').id),
)

export default router
