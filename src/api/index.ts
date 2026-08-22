import { Hono } from 'hono'
import type { AppEnv } from '../config/env'
import authRouter from './auth/router'
import categoriesRouter from './categories/router'
import chatRouter from './chat/router'
import expensesRouter from './expenses/router'
import recurringRouter from './recurring/router'

const api = new Hono<AppEnv>()

// Resource routers (budgets, recurring, reports, dashboard, chat, sync) mount
// here as they land.
api.route('/auth', authRouter)
api.route('/categories', categoriesRouter)
api.route('/chat', chatRouter)
api.route('/expenses', expensesRouter)
api.route('/recurring', recurringRouter)

export default api
