import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AddExpenseDialog } from './add-expense-dialog';

// Mock the hooks — using the same pattern as the other component tests
vi.mock('../lib/hooks', () => ({
    useCreateExpense: vi.fn(),
    useUpdateExpense: vi.fn(),
    useCategories: vi.fn(),
    useUploadReceipt: vi.fn()
}));

import {
    useCreateExpense,
    useUpdateExpense,
    useCategories,
    useUploadReceipt
} from '../lib/hooks';

const mockUseCreateExpense = vi.mocked(useCreateExpense);
const mockUseUpdateExpense = vi.mocked(useUpdateExpense);
const mockUseCategories = vi.mocked(useCategories);
const mockUseUploadReceipt = vi.mocked(useUploadReceipt);

function wrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function mockHooks(
    overrides: { createPending?: boolean; updatePending?: boolean } = {}
) {
    mockUseCreateExpense.mockReturnValue({
        mutateAsync: vi
            .fn()
            .mockResolvedValue({ id: 'exp-1', amountCents: 4250 }),
        isPending: overrides.createPending ?? false,
        isError: false,
        error: null,
        isSuccess: false,
        status: overrides.createPending ? 'pending' : 'idle',
        data: undefined,
        mutate: vi.fn(),
        reset: vi.fn()
    } as any);

    mockUseUpdateExpense.mockReturnValue({
        mutateAsync: vi
            .fn()
            .mockResolvedValue({ id: 'exp-1', amountCents: 4250 }),
        isPending: overrides.updatePending ?? false,
        isError: false,
        error: null,
        isSuccess: false,
        status: overrides.updatePending ? 'pending' : 'idle',
        data: undefined,
        mutate: vi.fn(),
        reset: vi.fn()
    } as any);

    mockUseCategories.mockReturnValue({
        data: [{ id: 'cat-1', name: 'Food' }],
        isPending: false,
        isLoading: false,
        isError: false,
        error: null,
        isSuccess: true,
        status: 'success',
        refetch: vi.fn()
    } as any);

    mockUseUploadReceipt.mockReturnValue({
        mutateAsync: vi
            .fn()
            .mockResolvedValue({ url: 'https://example.com/r.jpg' }),
        isPending: false,
        isError: false,
        error: null,
        isSuccess: false,
        status: 'idle',
        data: undefined,
        mutate: vi.fn(),
        reset: vi.fn()
    } as any);
}

async function fillValidForm() {
    const amountInput = screen.getByPlaceholderText('0.00');
    const descInput = screen.getByPlaceholderText('What was this for?');

    fireEvent.change(amountInput, { target: { value: '42.50' } });
    fireEvent.change(descInput, { target: { value: 'Groceries' } });

    // Select the category
    fireEvent.click(screen.getByText('Food'));

    // Wait for form to register values
    await waitFor(() => {
        expect((amountInput as HTMLInputElement).value).toBe('42.50');
    });
}

describe('AddExpenseDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockHooks();
    });

    it('renders the dialog when open is true', () => {
        render(<AddExpenseDialog open={true} onClose={vi.fn()} />, { wrapper });
        // Use heading role to avoid matching the submit button text
        expect(
            screen.getByRole('heading', { name: /add expense/i })
        ).toBeDefined();
    });

    it('returns null when open is false', () => {
        const { container } = render(
            <AddExpenseDialog open={false} onClose={vi.fn()} />,
            { wrapper }
        );
        expect(container.textContent).toBe('');
    });

    it('shows "Edit Expense" title and pre-fills form in edit mode', async () => {
        const expense = {
            id: 'exp-1',
            amountCents: 9999,
            description: 'Office supplies',
            categoryId: 'cat-1',
            date: '2026-01-15T00:00:00.000Z',
            userId: 'u-1',
            scope: 'personal' as const,
            receiptUrl: undefined as string | undefined,
            createdAt: '2026-01-15T00:00:00.000Z',
            updatedAt: '2026-01-15T00:00:00.000Z'
        };

        render(
            <AddExpenseDialog
                open={true}
                onClose={vi.fn()}
                expense={expense as any}
            />,
            { wrapper }
        );

        expect(
            screen.getByRole('heading', { name: /edit expense/i })
        ).toBeDefined();

        await waitFor(() => {
            const amountInput = screen.getByPlaceholderText(
                '0.00'
            ) as HTMLInputElement;
            expect(amountInput.value).toBe('99.99');
        });
    });

    it('shows validation error when submitting with empty amount', async () => {
        render(<AddExpenseDialog open={true} onClose={vi.fn()} />, { wrapper });
        // Submit the form directly (clicking the submit button works since
        // @tanstack/react-form handles it even without fill)
        const submitBtn = screen.getByRole('button', { name: 'Add Expense' });
        fireEvent.click(submitBtn);
        await waitFor(() => {
            expect(screen.getByText('Enter a valid amount')).toBeDefined();
        });
    });

    it('calls createExpense on valid form submit', async () => {
        const onClose = vi.fn();
        render(<AddExpenseDialog open={true} onClose={onClose} />, { wrapper });

        await fillValidForm();
        const submitBtn = screen.getByRole('button', { name: 'Add Expense' });
        fireEvent.click(submitBtn);

        const mutateAsync =
            mockUseCreateExpense.mock.results[0]?.value?.mutateAsync;
        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalled();
        });

        const callArgs = mutateAsync.mock.calls[0][0];
        expect(callArgs.amountCents).toBe(4250);
        expect(callArgs.description).toBe('Groceries');
        expect(callArgs.categoryId).toBe('cat-1');
    });

    it('calls updateExpense on valid form submit in edit mode', async () => {
        const expense = {
            id: 'exp-2',
            amountCents: 5000,
            description: 'Old description',
            categoryId: 'cat-1',
            date: '2026-01-15T00:00:00.000Z',
            userId: 'u-1',
            scope: 'personal' as const,
            receiptUrl: undefined as string | undefined,
            createdAt: '2026-01-15T00:00:00.000Z',
            updatedAt: '2026-01-15T00:00:00.000Z'
        };

        render(
            <AddExpenseDialog
                open={true}
                onClose={vi.fn()}
                expense={expense as any}
            />,
            { wrapper }
        );

        await waitFor(() => {
            const descInput = screen.getByPlaceholderText(
                'What was this for?'
            ) as HTMLInputElement;
            expect(descInput.value).toBe('Old description');
        });

        fireEvent.change(screen.getByPlaceholderText('What was this for?'), {
            target: { value: 'Updated description' }
        });

        const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
        fireEvent.click(saveBtn);

        const mutateAsync =
            mockUseUpdateExpense.mock.results[0]?.value?.mutateAsync;
        await waitFor(() => {
            expect(mutateAsync).toHaveBeenCalled();
        });
        expect(mutateAsync.mock.calls[0][0].id).toBe('exp-2');
        expect(mutateAsync.mock.calls[0][0].description).toBe(
            'Updated description'
        );
    });

    it('shows the success check animation after submit', async () => {
        render(<AddExpenseDialog open={true} onClose={vi.fn()} />, { wrapper });

        await fillValidForm();
        const submitBtn = screen.getByRole('button', { name: 'Add Expense' });
        fireEvent.click(submitBtn);

        expect(await screen.findByText('Expense added!')).toBeDefined();
    });

    it('closes when Escape is pressed', () => {
        const onClose = vi.fn();
        render(<AddExpenseDialog open={true} onClose={onClose} />, { wrapper });

        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('does not close on Escape when not open', () => {
        const onClose = vi.fn();
        render(<AddExpenseDialog open={false} onClose={onClose} />, {
            wrapper
        });
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Cancel button is clicked', () => {
        const onClose = vi.fn();
        render(<AddExpenseDialog open={true} onClose={onClose} />, { wrapper });
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalled();
    });

    it('closes on backdrop click', () => {
        const onClose = vi.fn();
        render(<AddExpenseDialog open={true} onClose={onClose} />, { wrapper });
        // Backdrop is the div with the fadeIn animation style
        const backdrop = document.querySelector('[style*="fadeIn"]')!;
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalled();
    });

    it('shows submit error when mutation fails', async () => {
        mockUseCreateExpense.mockReturnValue({
            ...mockUseCreateExpense(),
            mutateAsync: vi.fn().mockRejectedValue(new Error('Network error')),
            isError: false,
            status: 'idle'
        } as any);

        render(<AddExpenseDialog open={true} onClose={vi.fn()} />, { wrapper });

        await fillValidForm();
        const submitBtn = screen.getByRole('button', { name: 'Add Expense' });
        fireEvent.click(submitBtn);

        expect(await screen.findByText('Network error')).toBeDefined();
    });

    it('shows "Save Changes" button in edit mode', async () => {
        const expense = {
            id: 'exp-2',
            amountCents: 5000,
            description: 'Stuff',
            categoryId: 'cat-1',
            date: '2026-01-15T00:00:00.000Z',
            userId: 'u-1',
            scope: 'personal' as const,
            receiptUrl: undefined as string | undefined,
            createdAt: '2026-01-15T00:00:00.000Z',
            updatedAt: '2026-01-15T00:00:00.000Z'
        };

        render(
            <AddExpenseDialog
                open={true}
                onClose={vi.fn()}
                expense={expense as any}
            />,
            { wrapper }
        );

        await waitFor(() => {
            expect(
                screen.getByRole('button', { name: 'Save Changes' })
            ).toBeDefined();
        });
    });

    it('shows the "Open full form" link in create mode', () => {
        render(<AddExpenseDialog open={true} onClose={vi.fn()} />, { wrapper });
        expect(screen.getByText('Open full form')).toBeDefined();
    });

    it('does not show the "Open full form" link in edit mode', async () => {
        const expense = {
            id: 'exp-2',
            amountCents: 5000,
            description: 'Stuff',
            categoryId: 'cat-1',
            date: '2026-01-15T00:00:00.000Z',
            userId: 'u-1',
            scope: 'personal' as const,
            receiptUrl: undefined as string | undefined,
            createdAt: '2026-01-15T00:00:00.000Z',
            updatedAt: '2026-01-15T00:00:00.000Z'
        };

        render(
            <AddExpenseDialog
                open={true}
                onClose={vi.fn()}
                expense={expense as any}
            />,
            { wrapper }
        );

        await waitFor(() => {
            expect(screen.queryByText('Open full form')).toBeNull();
        });
    });
});
