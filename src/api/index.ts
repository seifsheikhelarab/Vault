import { Hono } from 'hono'
import type { AppBindings } from '../config/env'
import authRouter from './auth/router'

const api = new Hono<{ Bindings: AppBindings }>()

// Resource routers (expenses, categories, budgets, recurring, reports,
// dashboard, chat, sync) mount here as they land.
api.route('/auth', authRouter)

export default api
