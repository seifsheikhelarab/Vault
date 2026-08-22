import { Hono } from 'hono'

const api = new Hono<{ Bindings: CloudflareBindings }>()

// Resource routers (auth, expenses, categories, budgets, recurring,
// reports, dashboard, chat, sync) mount here as they land.

export default api
