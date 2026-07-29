import { describe, it, expect } from 'vitest';
import {
    createExpenseSchema,
    updateExpenseSchema,
    expenseQuerySchema
} from './expense.schema';

describe('expense schemas', () => {
    describe('createExpenseSchema', () => {
        const valid = {
            amount: 10.5,
            description: 'Coffee',
            date: '2024-01-15T00:00:00.000Z',
            categoryId: 'cat-123'
        };

        it('accepts a valid expense', () => {
            const result = createExpenseSchema.safeParse(valid);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.amount).toBe(10.5);
                expect(result.data.description).toBe('Coffee');
                expect(result.data.date).toBeInstanceOf(Date);
                expect(result.data.scope).toBe('personal');
            }
        });

        it('defaults scope to personal', () => {
            const result = createExpenseSchema.safeParse(valid);
            expect(result.success && result.data.scope).toBe('personal');
        });

        it('rejects zero and negative amounts', () => {
            expect(
                createExpenseSchema.safeParse({ ...valid, amount: 0 }).success
            ).toBe(false);
            expect(
                createExpenseSchema.safeParse({ ...valid, amount: -5 }).success
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
    });

    describe('updateExpenseSchema', () => {
        it('accepts partial updates', () => {
            const result = updateExpenseSchema.safeParse({
                description: 'Updated'
            });
            expect(result.success).toBe(true);
        });

        it('rejects invalid partial updates', () => {
            expect(updateExpenseSchema.safeParse({ amount: -1 }).success).toBe(
                false
            );
        });
    });

    describe('expenseQuerySchema', () => {
        it('applies defaults', () => {
            const result = expenseQuerySchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.page).toBe(1);
                expect(result.data.pageSize).toBe(20);
            }
        });

        it('parses numeric query params', () => {
            const result = expenseQuerySchema.safeParse({
                page: '2',
                pageSize: '50'
            });
            expect(result.success && result.data.page).toBe(2);
            expect(result.success && result.data.pageSize).toBe(50);
        });

        it('caps page size at 100', () => {
            const result = expenseQuerySchema.safeParse({ pageSize: 200 });
            expect(result.success).toBe(false);
        });
    });
});
