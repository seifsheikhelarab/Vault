import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CategoryPicker } from './category-picker';

// Mock the hooks module
vi.mock('../lib/hooks', () => ({
    useCategories: vi.fn()
}));

import { useCategories } from '../lib/hooks';

const mockUseCategories = vi.mocked(useCategories);

function wrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function mockCategories(data: any[], isPending = false) {
    mockUseCategories.mockReturnValue({
        data,
        isPending,
        isLoading: isPending,
        isError: false,
        error: null,
        isSuccess: !isPending,
        status: isPending ? 'pending' : 'success',
        refetch: vi.fn()
    } as any);
}

describe('CategoryPicker', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('shows a loading spinner while categories are pending', () => {
        mockCategories([], true);
        render(<CategoryPicker selectedId="" onSelect={vi.fn()} />, {
            wrapper
        });
        expect(screen.getByText('Loading...')).toBeDefined();
    });

    it('shows empty state when no categories exist', () => {
        mockCategories([]);
        render(<CategoryPicker selectedId="" onSelect={vi.fn()} />, {
            wrapper
        });
        expect(screen.getByText('No categories yet')).toBeDefined();
    });

    it('renders categories up to the max limit', () => {
        const cats = [
            { id: '1', name: 'Food', icon: '🍔' },
            { id: '2', name: 'Travel', icon: '✈️' },
            { id: '3', name: 'Rent', icon: '🏠' }
        ];
        mockCategories(cats);
        render(<CategoryPicker selectedId="" onSelect={vi.fn()} max={3} />, {
            wrapper
        });

        expect(screen.getByText('Food')).toBeDefined();
        expect(screen.getByText('Travel')).toBeDefined();
        expect(screen.getByText('Rent')).toBeDefined();
    });

    it('shows "+N more" when categories exceed max', () => {
        const cats = Array.from({ length: 8 }, (_, i) => ({
            id: String(i),
            name: `Cat ${i}`,
            icon: '📦'
        }));
        mockCategories(cats);
        render(<CategoryPicker selectedId="" onSelect={vi.fn()} max={6} />, {
            wrapper
        });

        expect(screen.getByText('2 more')).toBeDefined();
    });

    it('highlights the selected category with coral styling', () => {
        const cats = [
            { id: '1', name: 'Food', icon: '🍔' },
            { id: '2', name: 'Travel', icon: '✈️' }
        ];
        mockCategories(cats);
        render(<CategoryPicker selectedId="2" onSelect={vi.fn()} />, {
            wrapper
        });

        const travelBtn = screen.getByText('Travel').closest('button')!;
        expect(travelBtn.className).toContain('border-coral');
        expect(travelBtn.className).toContain('text-coral');

        const foodBtn = screen.getByText('Food').closest('button')!;
        // Check that the unselected button does NOT have 'border-coral'
        // as a standalone class (it has 'hover:border-coral-light' which
        // is different). Use classList for precise checking.
        expect(foodBtn.classList.contains('border-coral')).toBe(false);
    });

    it('calls onSelect with the category id when clicked', () => {
        const onSelect = vi.fn();
        const cats = [{ id: 'abc-123', name: 'Food', icon: '🍔' }];
        mockCategories(cats);
        render(<CategoryPicker selectedId="" onSelect={onSelect} />, {
            wrapper
        });

        fireEvent.click(screen.getByText('Food'));
        expect(onSelect).toHaveBeenCalledWith('abc-123');
    });

    it('shows a default folder icon when category has no icon', () => {
        const cats = [{ id: '1', name: 'Misc' }];
        mockCategories(cats);
        render(
            <CategoryPicker selectedId="" onSelect={vi.fn()} />,
            { wrapper }
        );

        // Should have an SVG (folder icon) inside the button
        const btn = screen.getByText('Misc').closest('button')!;
        expect(btn.querySelector('svg')).toBeTruthy();
    });
});
