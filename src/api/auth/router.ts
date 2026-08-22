import { Hono } from 'hono'
import { createAuth } from '../../config/auth'
import type { AppBindings } from '../../config/env'
import { createPrisma } from '../../config/prisma'

/**
 * Better Auth passthrough (ticket #5): forward the raw Request so Better Auth
 * owns its endpoints, cookies, and headers. basePath stays the default
 * `/api/auth` because this router is mounted at `/api/auth`.
 */
const router = new Hono<{ Bindings: AppBindings }>()

router.on(['POST', 'GET'], '*', (c) => {
  const db = createPrisma(c.env.DATABASE_URL)
  return createAuth(db, c.env).handler(c.req.raw)
})

export default router
