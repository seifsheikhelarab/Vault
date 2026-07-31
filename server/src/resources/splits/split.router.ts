import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { SplitController } from './split.controller';
import { createSplitSchema, splitQuerySchema } from './split.schema';
import type { AppEnv } from '../../lib/middleware';

const split = new Hono<AppEnv>();
const controller = new SplitController();

split.post('/', zValidator('json', createSplitSchema), (c) =>
    controller.create(c)
);

split.get('/', zValidator('query', splitQuerySchema), (c) =>
    controller.list(c)
);

split.delete('/', (c) => controller.delete(c));

export default split;
