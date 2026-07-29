import { describe, it, expect } from 'vitest';
import { addMemberSchema, updateMemberSchema } from './membership.schema';

describe('membership schemas', () => {
    describe('addMemberSchema', () => {
        it('accepts a valid member', () => {
            const result = addMemberSchema.safeParse({
                userId: 'user-123'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.role).toBe('member');
            }
        });

        it('accepts an admin role', () => {
            const result = addMemberSchema.safeParse({
                userId: 'user-123',
                role: 'admin'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.role).toBe('admin');
            }
        });

        it('rejects empty userId', () => {
            expect(
                addMemberSchema.safeParse({ userId: '' }).success
            ).toBe(false);
        });

        it('rejects invalid role', () => {
            expect(
                addMemberSchema.safeParse({
                    userId: 'user-123',
                    role: 'owner'
                }).success
            ).toBe(false);
        });
    });

    describe('updateMemberSchema', () => {
        it('accepts a valid role update', () => {
            const result = updateMemberSchema.safeParse({ role: 'admin' });
            expect(result.success).toBe(true);
        });

        it('rejects missing role', () => {
            expect(updateMemberSchema.safeParse({}).success).toBe(false);
        });

        it('rejects invalid role', () => {
            expect(
                updateMemberSchema.safeParse({ role: 'owner' }).success
            ).toBe(false);
        });
    });
});
