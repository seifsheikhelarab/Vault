import { describe, it, expect } from 'vitest';
import { createSplitSchema, splitQuerySchema } from './split.schema';

describe('split schemas', () => {
    describe('createSplitSchema', () => {
        const valid = {
            expenseId: 'exp-123',
            splits: [{ userId: 'user-1', amount: 10 }]
        };

        it('accepts a valid split', () => {
            expect(createSplitSchema.safeParse(valid).success).toBe(true);
        });

        it('rejects empty expenseId', () => {
            expect(
                createSplitSchema.safeParse({
                    ...valid,
                    expenseId: ''
                }).success
            ).toBe(false);
        });

        it('rejects empty splits array', () => {
            expect(
                createSplitSchema.safeParse({
                    ...valid,
                    splits: []
                }).success
            ).toBe(false);
        });

        it('rejects zero or negative amounts in splits', () => {
            expect(
                createSplitSchema.safeParse({
                    ...valid,
                    splits: [{ userId: 'user-1', amount: 0 }]
                }).success
            ).toBe(false);
        });
    });

    describe('splitQuerySchema', () => {
        it('accepts a query with expenseId', () => {
            const result = splitQuerySchema.safeParse({
                expenseId: 'exp-123'
            });
            expect(result.success).toBe(true);
        });

        it('accepts a query with groupId', () => {
            const result = splitQuerySchema.safeParse({ groupId: 'group-123' });
            expect(result.success).toBe(true);
        });

        it('accepts a query with userId', () => {
            const result = splitQuerySchema.safeParse({ userId: 'user-1' });
            expect(result.success).toBe(true);
        });

        it('rejects a query with no filters', () => {
            const result = splitQuerySchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });
});
