import { Hono } from 'hono';
import { createStorageProvider } from '../../lib/storage';
import type { AppEnv } from '../../lib/middleware';

const uploadRouter = new Hono<AppEnv>();

uploadRouter.post('/', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file as File | undefined;

    if (!file) {
        return c.json(
            { success: false, error: { message: 'No file provided' } },
            400
        );
    }

    if (!file.type.startsWith('image/')) {
        return c.json(
            {
                success: false,
                error: { message: 'Only image files are allowed' }
            },
            400
        );
    }

    if (file.size > 10 * 1024 * 1024) {
        return c.json(
            {
                success: false,
                error: { message: 'File too large. Maximum size is 10MB' }
            },
            400
        );
    }

    try {
        const storage = createStorageProvider();
        const url = await storage.upload(file);
        return c.json({ success: true, data: { url } }, 201);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        return c.json({ success: false, error: { message } }, 500);
    }
});

export default uploadRouter;
