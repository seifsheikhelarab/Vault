import type { Context, Env } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

export type ErrorIssues = {
    formErrors: string[];
    fieldErrors: Record<string, string[]>;
};

type Envelope = {
    error: { code: string; message: string; issues?: ErrorIssues };
};

/** Status → envelope code + fallback message, one table. */
const HTTP_ERRORS: Record<number, { code: string; message: string }> = {
    400: { code: 'BAD_REQUEST', message: 'Bad request' },
    401: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
    404: { code: 'NOT_FOUND', message: 'Not found' },
    409: { code: 'CONFLICT', message: 'Conflict' },
    422: { code: 'VALIDATION_ERROR', message: 'Validation error' },
    502: { code: 'UPSTREAM_ERROR', message: 'Upstream error' },
};

function envelope(code: string, message: string, issues?: ErrorIssues): Envelope {
    return { error: issues ? { code, message, issues } : { code, message } };
}

export function zodError(error: z.ZodError, c: Context): Response {
    const { formErrors, fieldErrors } = z.flattenError(error);
    return c.json(
        envelope('VALIDATION_ERROR', 'Invalid request', { formErrors, fieldErrors }),
        422,
    );
}

// Env-agnostic generic: the handler only writes responses, so it attaches to
// any app (root, resource routers, test probes) regardless of env shape.
export const onError = <E extends Env>(err: Error, c: Context<E>): Response => {
    if (err instanceof z.ZodError) return zodError(err, c);

    if (err instanceof HTTPException) {
        const status = err.status;
        const known = HTTP_ERRORS[status];
        // Unknown >=500 collapse to a sanitized 500 so internals never leak.
        if (!known && status >= 500) {
            console.error(err);
            return c.json(envelope('INTERNAL', 'Internal server error'), 500);
        }
        const message = err.message || known?.message || 'Error';
        return c.json(envelope(known?.code ?? 'ERROR', message), status);
    }

    console.error(err);
    return c.json(envelope('INTERNAL', 'Internal server error'), 500);
};
