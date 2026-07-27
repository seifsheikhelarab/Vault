import { Hono } from 'hono';
import { ok } from '../../lib/response';
import { db } from '../../lib/db';
import { categories } from '../../lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { AppEnv } from '../../lib/middleware';

const category = new Hono<AppEnv>();

category.post('/', async (c) => {
    const userId = c.get('userId');
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const [cat] = await db
        .insert(categories)
        .values({ ...body, id, userId })
        .returning();
    return c.json(ok(cat), 201);
});

category.get('/', async (c) => {
    const data = await db
        .select()
        .from(categories)
        .orderBy(desc(categories.createdAt));
    return c.json(ok(data));
});

export default category;
