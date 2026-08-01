import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InviteMemberDialog } from './invite-member-dialog';

// Mock the hooks module
vi.mock('../lib/hooks', () => ({
    useInviteMember: vi.fn()
}));

import { useInviteMember } from '../lib/hooks';

const mockUseInviteMember = vi.mocked(useInviteMember);

function wrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function mockInviteMember() {
    mockUseInviteMember.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue({ id: 'inv-1' }),
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

describe('InviteMemberDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockInviteMember();
    });

    it('renders the dialog when open is true', () => {
        render(
            <InviteMemberDialog
                open={true}
                onClose={vi.fn()}
                organizationId="org-1"
            />,
            { wrapper }
        );
        expect(screen.getByText('Invite Member')).toBeDefined();
        expect(
            screen.getByPlaceholderText('colleague@company.com')
        ).toBeDefined();
    });

    it('returns null when open is false', () => {
        const { container } = render(
            <InviteMemberDialog
                open={false}
                onClose={vi.fn()}
                organizationId="org-1"
            />,
            { wrapper }
        );
        expect(container.textContent).toBe('');
    });

    it('shows validation error for empty email on submit', async () => {
        render(
            <InviteMemberDialog
                open={true}
                onClose={vi.fn()}
                organizationId="org-1"
            />,
            { wrapper }
        );
        // Submit the form directly since the button is disabled when email is empty
        const form = screen.getByRole('dialog').querySelector('form')!;
        fireEvent.submit(form);
        expect(await screen.findByText('Email is required')).toBeDefined();
    });

    it('shows validation error for invalid email format', async () => {
        render(
            <InviteMemberDialog
                open={true}
                onClose={vi.fn()}
                organizationId="org-1"
            />,
            { wrapper }
        );
        const input = screen.getByPlaceholderText('colleague@company.com');
        fireEvent.change(input, { target: { value: 'not-an-email' } });
        // Submit the form directly
        const form = screen.getByRole('dialog').querySelector('form')!;
        fireEvent.submit(form);
        expect(await screen.findByText('Enter a valid email')).toBeDefined();
    });

    it('toggles between member and admin roles', () => {
        render(
            <InviteMemberDialog
                open={true}
                onClose={vi.fn()}
                organizationId="org-1"
            />,
            { wrapper }
        );
        const adminBtn = screen.getByText('admin');
        fireEvent.click(adminBtn);
        // admin button should now be selected (have white background class)
        expect(adminBtn.className).toContain('bg-white');
        expect(adminBtn.className).toContain('shadow-warm-sm');
    });

    it('calls inviteMember with correct data on valid submit', async () => {
        const mutateAsync = vi.fn().mockResolvedValue({ id: 'inv-1' });
        mockUseInviteMember.mockReturnValue({
            mutateAsync,
            isPending: false,
            isError: false,
            error: null,
            isSuccess: false,
            status: 'idle',
            data: undefined,
            mutate: vi.fn(),
            reset: vi.fn()
        } as any);

        render(
            <InviteMemberDialog
                open={true}
                onClose={vi.fn()}
                organizationId="org-1"
            />,
            { wrapper }
        );

        const input = screen.getByPlaceholderText('colleague@company.com');
        fireEvent.change(input, { target: { value: 'new@company.com' } });
        fireEvent.click(screen.getByText('admin'));
        fireEvent.click(screen.getByText('Send Invitation'));

        await vi.waitFor(() => {
            expect(mutateAsync).toHaveBeenCalledWith({
                organizationId: 'org-1',
                email: 'new@company.com',
                role: 'admin'
            });
        });
    });

    it('shows success confirmation after sending invitation', async () => {
        const mutateAsync = vi.fn().mockResolvedValue({ id: 'inv-1' });
        mockUseInviteMember.mockReturnValue({
            mutateAsync,
            isPending: false,
            isError: false,
            error: null,
            isSuccess: false,
            status: 'idle',
            data: undefined,
            mutate: vi.fn(),
            reset: vi.fn()
        } as any);

        render(
            <InviteMemberDialog
                open={true}
                onClose={vi.fn()}
                organizationId="org-1"
            />,
            { wrapper }
        );

        const input = screen.getByPlaceholderText('colleague@company.com');
        fireEvent.change(input, { target: { value: 'new@company.com' } });
        fireEvent.click(screen.getByText('Send Invitation'));

        expect(await screen.findByText('Invitation sent!')).toBeDefined();
        expect(screen.getByText('new@company.com')).toBeDefined();
    });

    it('shows submit error from mutation', async () => {
        const mutateAsync = vi
            .fn()
            .mockRejectedValue(new Error('Domain not allowed'));
        mockUseInviteMember.mockReturnValue({
            mutateAsync,
            isPending: false,
            isError: false,
            error: null,
            isSuccess: false,
            status: 'idle',
            data: undefined,
            mutate: vi.fn(),
            reset: vi.fn()
        } as any);

        render(
            <InviteMemberDialog
                open={true}
                onClose={vi.fn()}
                organizationId="org-1"
            />,
            { wrapper }
        );

        const input = screen.getByPlaceholderText('colleague@company.com');
        fireEvent.change(input, { target: { value: 'bad@company.com' } });
        fireEvent.click(screen.getByText('Send Invitation'));

        expect(await screen.findByText('Domain not allowed')).toBeDefined();
    });

    it('calls onClose when cancel is clicked', () => {
        const onClose = vi.fn();
        render(
            <InviteMemberDialog
                open={true}
                onClose={onClose}
                organizationId="org-1"
            />,
            { wrapper }
        );
        fireEvent.click(screen.getByText('Cancel'));
        expect(onClose).toHaveBeenCalled();
    });
});
