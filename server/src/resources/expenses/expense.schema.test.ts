import { describe, it, expect } from 'vitest';
import {
    createExpenseSchema,
    reviseExpenseSchema,
    deleteExpenseSchema
} from './expense.schema';

describe('expense schemas', () => {
    describe('createExpenseSchema', () => {
        const valid = {
            amountCents: 1050,
            description: 'Coffee',
            date: '2024-01-15T00:00:00.000Z',
            categoryId: 'cat-123'
        };

        it('accepts a valid expense', () => {
            const result = createExpenseSchema.safeParse(valid);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amountCents).toBe(1050);
                expect(result.data.description).toBe('Coffee');
                expect(result.data.scope).toBe('personal');
            }
        });

        it('defaults scope to personal', () => {
            const result = createExpenseSchema.safeParse(valid);
            expect(result.success && result.data.scope).toBe('personal');
        });

        it('rejects zero and negative amounts', () => {
            expect(
                createExpenseSchema.safeParse({ ...valid, amountCents: 0 })
                    .success
            ).toBe(false);
            expect(
                createExpenseSchema.safeParse({ ...valid, amountCents: -500 })
                    .success
            ).toBe(false);
        });

        it('rejects non-integer amounts (floating point is not allowed)', () => {
            expect(
                createExpenseSchema.safeParse({ ...valid, amountCents: 10.5 })
                    .success
            ).toBe(false);
        });

        it('rejects amounts above the business maximum', () => {
            expect(
                createExpenseSchema.safeParse({
                    ...valid,
                    amountCents: 100_000_001
                }).success
            ).toBe(false);
        });

        it('rejects empty description', () => {
            expect(
                createExpenseSchema.safeParse({ ...valid, description: '' })
                    .success
            ).toBe(false);
        });

        it('rejects invalid date', () => {
            expect(
                createExpenseSchema.safeParse({
                    ...valid,
                    date: 'not-a-date'
                }).success
            ).toBe(false);
        });

        it('rejects invalid receiptUrl', () => {
            expect(
                createExpenseSchema.safeParse({
                    ...valid,
                    receiptUrl: 'not-a-url'
                }).success
            ).toBe(false);
        });

        it('accepts optional fields', () => {
            const result = createExpenseSchema.safeParse({
                ...valid,
                receiptUrl: 'https://example.com/receipt.png',
                groupId: 'group-123',
                scope: 'group'
            });
            expect(result.success).toBe(true);
        });

        it('accepts splits that sum with the expense', () => {
            const result = createExpenseSchema.safeParse({
                ...valid,
                splits: [
                    { userId: 'u1', amountCents: 600 },
                    { userId: 'u2', amountCents: 450 }
                ]
            });
            expect(result.success).toBe(true);
        });

        it('rejects negative split amounts', () => {
            const result = createExpenseSchema.safeParse({
                ...valid,
                splits: [{ userId: 'u1', amountCents: -1 }]
            });
            expect(result.success).toBe(false);
        });
    });

    describe('reviseExpenseSchema', () => {
        const valid = {
            amountCents: 2500,
            description: 'Updated lunch',
            categoryId: 'cat-123',
            reason: 'Split was wrong'
        };

        it('accepts a valid revision', () => {
            const result = reviseExpenseSchema.safeParse(valid);
            expect(result.success).toBe(true);
        });

        it('rejects revisions without a reason', () => {
            expect(
                reviseExpenseSchema.safeParse({ ...valid, reason: '' }).success
            ).toBe(false);
        });

        it('rejects invalid partial updates', () => {
            expect(
                reviseExpenseSchema.safeParse({ ...valid, amountCents: -1 })
                    .success
            ).toBe(false);
        });
    });

    describe('deleteExpenseSchema', () => {
        it('requires a reason', () => {
            expect(deleteExpenseSchema.safeParse({ reason: '' }).success).toBe(
                false
            );
            expect(
                deleteExpenseSchema.safeParse({ reason: 'Entered by mistake' })
                    .success
            ).toBe(true);
        });
    });
});
