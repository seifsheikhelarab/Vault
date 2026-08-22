import { Hono } from 'hono'
import { requireAuth } from '../../config/auth'
import type { AppEnv } from '../../config/env'
import {
  createExpenseController,
  deleteExpenseController,
  getExpenseController,
  listExpensesController,
  updateExpenseController,
} from './controller'
import {
  createExpenseSchema,
  idParamSchema,
  listExpensesQuerySchema,
  updateExpenseSchema,
  validateJson,
  validateParam,
  validateQuery,
} from './validation'

/**
 * Expenses resource (ticket #7), mounted at /api/expenses. Session-scoped via
 * requireAuth; errors flow through the central onError.
 */
const router = new Hono<AppEnv>()

router.use('*', requireAuth)

router.post('/', validateJson(createExpenseSchema), (c) =>
  createExpenseController(c, c.req.valid('json')),
)
router.get('/', validateQuery(listExpensesQuerySchema), (c) =>
  listExpensesController(c, c.req.valid('query')),
)
router.get('/:id', validateParam(idParamSchema), (c) =>
  getExpenseController(c, c.req.valid('param').id),
)
router.patch(
  '/:id',
  validateParam(idParamSchema),
  validateJson(updateExpenseSchema),
  (c) => updateExpenseController(c, c.req.valid('param').id, c.req.valid('json')),
)
router.delete('/:id', validateParam(idParamSchema), (c) =>
  deleteExpenseController(c, c.req.valid('param').id),
)

export default router
