import { describe, it, expect } from 'vitest';
import { ok, fail } from './response';

describe('response helpers', () => {
    describe('ok', () => {
        it('wraps data in a success response', () => {
            const data = { id: '1', amount: 10.5 };
            expect(ok(data)).toEqual({ success: true, data });
        });

        it('preserves complex nested data', () => {
            const data = { users: [{ id: 'a' }, { id: 'b' }] };
            expect(ok(data)).toEqual({ success: true, data });
        });
    });

    describe('fail', () => {
        it('formats an error response', () => {
            expect(fail('BAD_REQUEST', 'Invalid input')).toEqual({
                success: false,
                error: { code: 'BAD_REQUEST', message: 'Invalid input' }
            });
        });
    });
});
