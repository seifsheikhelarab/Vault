import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReceiptUpload } from './receipt-upload';

// Mock the hooks module
vi.mock('../lib/hooks', () => ({
    useUploadReceipt: vi.fn()
}));

import { useUploadReceipt } from '../lib/hooks';

const mockUseUploadReceipt = vi.mocked(useUploadReceipt);

function wrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function mockUpload(state: 'idle' | 'pending' = 'idle') {
    mockUseUploadReceipt.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue({ url: 'https://example.com/receipt.jpg' }),
        isPending: state === 'pending',
        isError: false,
        error: null,
        isSuccess: false,
        status: state,
        data: undefined,
        mutate: vi.fn(),
        reset: vi.fn()
    } as any);
}

describe('ReceiptUpload', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUpload();
    });

    it('shows upload zone when no value is provided', () => {
        render(
            <ReceiptUpload value={undefined} onChange={vi.fn()} />,
            { wrapper }
        );
        expect(screen.getByText('Add receipt')).toBeDefined();
        expect(screen.getByText('Drag & drop or click to browse')).toBeDefined();
    });

    it('shows a file input for browsing', () => {
        const { container } = render(
            <ReceiptUpload value={undefined} onChange={vi.fn()} />,
            { wrapper }
        );
        const input = container.querySelector('input[type="file"]');
        expect(input).toBeTruthy();
        expect(input!.getAttribute('accept')).toBe('image/*');
    });

    it('shows the receipt preview when value is provided', () => {
        render(
            <ReceiptUpload value="https://example.com/receipt.jpg" onChange={vi.fn()} />,
            { wrapper }
        );
        expect(screen.getByText('Receipt attached')).toBeDefined();
        const img = screen.getByAltText('Receipt preview');
        expect(img).toBeTruthy();
        expect((img as HTMLImageElement).src).toBe('https://example.com/receipt.jpg');
    });

    it('shows "Remove" button on hover over preview', () => {
        render(
            <ReceiptUpload value="https://example.com/receipt.jpg" onChange={vi.fn()} />,
            { wrapper }
        );
        expect(screen.getByText('Remove')).toBeDefined();
    });

    it('calls onChange with undefined when Remove is clicked', () => {
        const onChange = vi.fn();
        render(
            <ReceiptUpload value="https://example.com/receipt.jpg" onChange={onChange} />,
            { wrapper }
        );
        fireEvent.click(screen.getByText('Remove'));
        expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('shows "Drop receipt here" when dragging over the upload zone', () => {
        render(
            <ReceiptUpload value={undefined} onChange={vi.fn()} />,
            { wrapper }
        );
        // The upload zone is the outer div inside the ReceiptUpload's
        // JSX when there's no preview — find it by the drop handlers
        const dropZone = screen.getByText('Add receipt').closest('div[class*="border-dashed"]')!;

        fireEvent.dragOver(dropZone);
        expect(screen.getByText('Drop receipt here')).toBeDefined();
    });

    it('shows error for non-image files', async () => {
        const { container } = render(
            <ReceiptUpload value={undefined} onChange={vi.fn()} />,
            { wrapper }
        );
        const input = container.querySelector('input[type="file"]')!;

        const file = new File(['not-an-image'], 'doc.pdf', { type: 'application/pdf' });
        fireEvent.change(input, { target: { files: [file] } });

        expect(
            await screen.findByText('Please select an image file (PNG, JPG)')
        ).toBeDefined();
    });

    it('shows error for files larger than 10MB', async () => {
        const { container } = render(
            <ReceiptUpload value={undefined} onChange={vi.fn()} />,
            { wrapper }
        );
        const input = container.querySelector('input[type="file"]')!;

        // Create a mock file with size > 10MB
        const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'huge.jpg', {
            type: 'image/jpeg'
        });
        // Override size since File constructor doesn't set it properly
        Object.defineProperty(largeFile, 'size', { value: 11 * 1024 * 1024 });

        fireEvent.change(input, { target: { files: [largeFile] } });

        expect(
            await screen.findByText('File too large. Maximum size is 10MB')
        ).toBeDefined();
    });

    it('shows a loading spinner during upload', () => {
        mockUpload('pending');
        const { container } = render(
            <ReceiptUpload value={undefined} onChange={vi.fn()} />,
            { wrapper }
        );
        expect(screen.getByText('Uploading receipt...')).toBeDefined();
    });
});
