import { Hono } from 'hono';
import { createAuth } from '../../config/auth';
import type { AppEnv } from '../../config/env';

/**
 * Better Auth passthrough (ticket #5): forward the raw Request so Better Auth
 * owns its endpoints, cookies, and headers. basePath stays the default
 * `/api/auth` because this router is mounted at `/api/auth`. The db comes
 * from the api aggregator middleware on context.
 */
const router = new Hono<AppEnv>();

router.on(['POST', 'GET'], '*', (c) => {
    return createAuth(c.get('db'), c.env).handler(c.req.raw);
});

export default router;
