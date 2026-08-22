import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import api from './api'
import { onError } from './config/errors'
import { globalRateLimit, strictRateLimit } from './config/rate-limit'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use('/api/auth/*', strictRateLimit)
app.use('/api/chat/*', strictRateLimit)
app.use('/api/*', globalRateLimit)

app.route('/api', api)

app.notFound(() => {
  throw new HTTPException(404, { message: 'Not found' })
})

app.onError(onError)

export default app
