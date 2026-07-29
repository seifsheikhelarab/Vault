export function validateAmount({ value }: { value: string }) {
    if (!value) return 'Enter a valid amount';
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) || parsed <= 0
        ? 'Enter a valid amount'
        : undefined;
}

export function validateDescription({ value }: { value: string }) {
    return !value.trim() ? 'Description is required' : undefined;
}

export function validateRequired(errorMessage: string) {
    return ({ value }: { value: string }) => {
        return !value ? errorMessage : undefined;
    };
}

export const validateCategoryId = validateRequired('Select a category');
export const validateDate = validateRequired('Date is required');
