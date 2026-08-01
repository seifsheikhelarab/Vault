import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { auth } from './auth';

/** Shared env type for all Hono apps that use auth. */
export type AppEnv = {
    Variables: {
        userId: string;
        session: {
            user: {
                id: string;
                name: string;
                email: string;
                image?: string | null;
            };
            session: { id: string; createdAt: Date };
        };
    };
};

/** Typed Hono context — use in controller method signatures. */
export type AppContext = Context<AppEnv>;

/**
 * Extract JSON body validated by zValidator middleware.
 * The type parameter is a narrowing assertion: zValidator already
 * validated the data at runtime in the router layer.
 */
export function validBody<T>(c: AppContext): T {
    return (c.req as unknown as { valid(target: 'json'): T }).valid('json');
}

/**
 * Extract query params validated by zValidator middleware.
 */
export function validQuery<T>(c: AppContext): T {
    return (c.req as unknown as { valid(target: 'query'): T }).valid('query');
}

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
    // Test mode: allow setting userId via x-test-user-id header
    const testUserId = c.req.header('x-test-user-id');
    if (testUserId && process.env.NODE_ENV === 'test') {
        c.set('userId', testUserId);
        c.set('session', {
            user: {
                id: testUserId,
                name: 'Test User',
                email: 'test@example.com'
            },
            session: { id: 'test-session', createdAt: new Date() }
        } as AppEnv['Variables']['session']);
        return next();
    }

    const session = await auth.api.getSession({
        headers: c.req.raw.headers
    });

    if (!session) {
        return c.json(
            {
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Not authenticated' }
            },
            401
        );
    }

    c.set('userId', session.user.id);
    c.set('session', session as AppEnv['Variables']['session']);
    await next();
});
