import { describe, it, expect } from 'vitest';
import { addMemberSchema, updateMemberSchema } from './membership.schema';

describe('membership schemas', () => {
    describe('addMemberSchema', () => {
        it('accepts a valid email', () => {
            const result = addMemberSchema.safeParse({
                email: 'test@example.com'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.role).toBe('member');
            }
        });

        it('accepts an admin role', () => {
            const result = addMemberSchema.safeParse({
                email: 'test@example.com',
                role: 'admin'
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.role).toBe('admin');
            }
        });

        it('rejects empty email', () => {
            expect(addMemberSchema.safeParse({ email: '' }).success).toBe(
                false
            );
        });

        it('rejects invalid email', () => {
            expect(
                addMemberSchema.safeParse({
                    email: 'not-an-email'
                }).success
            ).toBe(false);
        });

        it('rejects invalid role', () => {
            expect(
                addMemberSchema.safeParse({
                    email: 'test@example.com',
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
