import type { buildApp } from './helpers';

type Harness = ReturnType<typeof buildApp>;

/**
 * Authed-user fixture (ticket #5). Registers through the real signup route,
 * returns the session cookie headers for authenticated requests plus the
 * created user. Every call gets a unique email so tests stay independent.
 */
export async function registerUser(
    t: Harness,
    input: { name?: string; email?: string; password?: string } = {},
): Promise<{
    user: { id: string; email: string; name: string };
    password: string;
    headers: Headers;
}> {
    const password = input.password ?? 'correct-horse-battery';
    const body = {
        name: input.name ?? 'Test User',
        email: input.email ?? `${crypto.randomUUID()}@test.local`,
        password,
    };
    const res = await t.request('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (res.status !== 200) {
        throw new Error(`registerUser failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { user: { id: string; email: string; name: string } };
    return {
        user: json.user,
        password,
        headers: withCookie(res),
    };
}

/** Copy the Better Auth session cookie onto fresh request headers. */
export function withCookie(res: Response): Headers {
    const cookie = res.headers.get('set-cookie');
    if (!cookie) throw new Error('expected a set-cookie on the auth response');
    const headers = new Headers();
    headers.set('cookie', cookie);
    return headers;
}
