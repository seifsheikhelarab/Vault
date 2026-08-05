import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { GroupController } from './group.controller';
import { createGroupSchema } from './group.schema';
import type { AppEnv } from '../../lib/middleware';

const group = new Hono<AppEnv>();
const controller = new GroupController();

group.post('/', zValidator('json', createGroupSchema), (c) =>
    controller.create(c)
);
group.get('/', (c) => controller.list(c));
group.get('/summary', (c) => controller.summary(c));
group.get('/:id', (c) => controller.get(c));
group.post('/:id/close', (c) => controller.close(c));

export default group;
