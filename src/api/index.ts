import { Hono } from 'hono'
import type { AppEnv } from '../config/env'
import authRouter from './auth/router'
import categoriesRouter from './categories/router'
import chatRouter from './chat/router'

const api = new Hono<AppEnv>()

// Resource routers (expenses, budgets, recurring, reports,
// dashboard, chat, sync) mount here as they land.
api.route('/auth', authRouter)
api.route('/categories', categoriesRouter)
api.route('/chat', chatRouter)

export default api
