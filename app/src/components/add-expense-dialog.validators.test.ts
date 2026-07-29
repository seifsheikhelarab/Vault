import { describe, it, expect } from 'vitest';
import {
    validateAmount,
    validateCategoryId,
    validateDate,
    validateDescription,
    validateRequired
} from './add-expense-dialog.validators';

describe('AddExpenseDialog validators', () => {
    describe('validateAmount', () => {
        it('returns undefined for positive amounts', () => {
            expect(validateAmount({ value: '10' })).toBeUndefined();
            expect(validateAmount({ value: '0.01' })).toBeUndefined();
            expect(validateAmount({ value: '123.45' })).toBeUndefined();
        });

        it('returns an error for zero', () => {
            expect(validateAmount({ value: '0' })).toBe('Enter a valid amount');
        });

        it('returns an error for negative amounts', () => {
            expect(validateAmount({ value: '-5' })).toBe('Enter a valid amount');
        });

        it('returns an error for empty string', () => {
            expect(validateAmount({ value: '' })).toBe('Enter a valid amount');
        });

        it('returns an error for non-numeric input', () => {
            expect(validateAmount({ value: 'abc' })).toBe('Enter a valid amount');
        });

        it('returns an error for whitespace-only input', () => {
            expect(validateAmount({ value: '   ' })).toBe(
                'Enter a valid amount'
            );
        });
    });

    describe('validateDescription', () => {
        it('returns undefined for non-empty descriptions', () => {
            expect(validateDescription({ value: 'Coffee' })).toBeUndefined();
            expect(validateDescription({ value: '  Lunch  ' })).toBeUndefined();
        });

        it('returns an error for empty string', () => {
            expect(validateDescription({ value: '' })).toBe(
                'Description is required'
            );
        });

        it('returns an error for whitespace-only string', () => {
            expect(validateDescription({ value: '   ' })).toBe(
                'Description is required'
            );
        });
    });

    describe('validateRequired', () => {
        it('returns undefined when value is present', () => {
            const validator = validateRequired('Field is required');
            expect(validator({ value: 'x' })).toBeUndefined();
        });

        it('returns the configured message when value is empty', () => {
            const validator = validateRequired('Field is required');
            expect(validator({ value: '' })).toBe('Field is required');
        });
    });

    describe('validateCategoryId', () => {
        it('returns undefined when a category is selected', () => {
            expect(validateCategoryId({ value: 'cat-123' })).toBeUndefined();
        });

        it('returns an error when no category is selected', () => {
            expect(validateCategoryId({ value: '' })).toBe(
                'Select a category'
            );
        });
    });

    describe('validateDate', () => {
        it('returns undefined when a date is present', () => {
            expect(validateDate({ value: '2024-01-01' })).toBeUndefined();
        });

        it('returns an error when no date is present', () => {
            expect(validateDate({ value: '' })).toBe('Date is required');
        });
    });
});
