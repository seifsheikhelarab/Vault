import { Hono } from 'hono';
import { UserService } from './user.service';
import { ok } from '../../lib/response';
import type { AppEnv } from '../../lib/middleware';

const userRouter = new Hono<AppEnv>();
const service = new UserService();

// GET /api/users/search?q=...
userRouter.get('/search', async (c) => {
    const q = c.req.query('q') ?? '';
    const results = await service.search(q);
    return c.json(ok(results));
});

export default userRouter;
