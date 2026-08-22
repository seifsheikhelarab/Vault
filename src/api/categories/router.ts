import { Hono } from 'hono'
import { requireAuth } from '../../config/auth'
import type { AppEnv } from '../../config/env'
import {
  createCategoryController,
  deleteCategoryController,
  getCategoryController,
  listCategoriesController,
  updateCategoryController,
} from './controller'
import {
  createCategorySchema,
  idParamSchema,
  updateCategorySchema,
  validateJson,
  validateParam,
} from './validation'

/**
 * Categories resource (ticket #6), mounted at /api/categories. Every route is
 * session-scoped via requireAuth; errors flow through the central onError.
 */
const router = new Hono<AppEnv>()

router.use('*', requireAuth)

router.post('/', validateJson(createCategorySchema), (c) =>
  createCategoryController(c, c.req.valid('json')),
)
router.get('/', (c) => listCategoriesController(c))
router.get('/:id', validateParam(idParamSchema), (c) =>
  getCategoryController(c, c.req.valid('param').id),
)
router.patch(
  '/:id',
  validateParam(idParamSchema),
  validateJson(updateCategorySchema),
  (c) => updateCategoryController(c, c.req.valid('param').id, c.req.valid('json')),
)
router.delete('/:id', validateParam(idParamSchema), (c) =>
  deleteCategoryController(c, c.req.valid('param').id),
)

export default router
