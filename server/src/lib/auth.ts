import { betterAuth } from 'better-auth';
import { organization, testUtils } from 'better-auth/plugins';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { db } from './db';
import * as schema from './db/schema';

const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3001/api/auth';

export const auth = betterAuth({
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET!,
    trustedOrigins: [process.env.CORS_ORIGIN || 'http://localhost:5173'],
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: {
        enabled: true
    },
    user: {
        deleteUser: {
            enabled: true
        }
    },
    plugins: [
        organization(),
        // testUtils() is included unconditionally because it does not expose public routes.
        // Its helpers (ctx.test) are only accessible server-side and are not reachable via HTTP.
        testUtils()
    ]
});

export type Session = typeof auth.$Infer.Session;
