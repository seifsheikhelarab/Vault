import { useCallback, useEffect, useState } from 'react';
import { useInviteMember } from '../lib/hooks';

interface InviteMemberDialogProps {
    open: boolean;
    onClose: () => void;
    organizationId: string;
}

const ROLES = ['member', 'admin'] as const;

export function InviteMemberDialog({
    open,
    onClose,
    organizationId
}: InviteMemberDialogProps) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'member' | 'admin'>('member');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const inviteMember = useInviteMember();

    const handleClose = useCallback(() => {
        if (submitting) return;
        onClose();
        setTimeout(() => {
            setEmail('');
            setRole('member');
            setErrors({});
            setSent(false);
        }, 200);
    }, [onClose, submitting]);

    // Close on Escape
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, handleClose]);

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!email.trim()) {
            errs.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            errs.email = 'Enter a valid email';
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || submitting) return;

        setSubmitting(true);
        try {
            await inviteMember.mutateAsync({
                organizationId,
                email: email.trim(),
                role
            });
            setSent(true);
            setSubmitting(false);
            setTimeout(() => handleClose(), 1500);
        } catch (err: unknown) {
            setErrors({
                submit:
                    err instanceof Error
                        ? err.message
                        : 'Failed to send invitation'
            });
            setSubmitting(false);
        }
    };

    if (!open) return null;

    return (
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget && !submitting) handleClose();
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

            {/* Sent confirmation */}
            {sent && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center">
                    <div className="text-center">
                        <div className="t-success-check" data-state="in">
                            <svg
                                width="64"
                                height="64"
                                viewBox="0 0 80 80"
                                fill="none"
                            >
                                <circle
                                    cx="40"
                                    cy="40"
                                    r="38"
                                    stroke="#34C759"
                                    strokeWidth="3"
                                    fill="none"
                                />
                                <path
                                    d="M24 40 L35 51 L56 30"
                                    stroke="#34C759"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                />
                            </svg>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-text-primary">
                            Invitation sent!
                        </p>
                        <p className="text-xs text-text-tertiary mt-1">
                            {email}
                        </p>
                    </div>
                </div>
            )}

            <div
                role="dialog"
                aria-modal="true"
                aria-label="Invite member"
                className="relative bg-surface rounded-[16px] shadow-warm-lg border border-border-light w-full max-w-sm overflow-hidden"
                style={{
                    animation: 'slideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
                }}
            >
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border-light">
                    <h2 className="text-base font-semibold text-text-primary">
                        Invite Member
                    </h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={submitting}
                        className="p-1 rounded-[6px] text-text-tertiary hover:text-text-primary hover:bg-cream/60 transition-colors"
                        aria-label="Close"
                        data-cuelume-press
                    >
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
                    {errors.submit && (
                        <div className="p-2.5 rounded-[8px] bg-error/10 border border-error/20 text-xs text-error font-medium">
                            {errors.submit}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                            Email Address
                        </label>
                        <input
                            autoFocus
                            type="email"
                            placeholder="colleague@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`w-full px-3 py-2 bg-surface border rounded-[8px] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150 ${errors.email ? 'border-error' : 'border-border'}`}
                        />
                        {errors.email && (
                            <p className="text-xs text-error mt-1">
                                {errors.email}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                            Role
                        </label>
                        <div className="flex gap-2 p-1 bg-cream/60 dark:bg-white/[0.06] rounded-[8px]">
                            {ROLES.map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r)}
                                    data-cuelume-toggle
                                    className={`flex-1 py-2 px-3 rounded-[6px] text-xs font-medium capitalize transition-colors duration-150 ${
                                        role === r
                                            ? 'bg-white dark:bg-[#2a2a2a] text-text-primary shadow-warm-sm'
                                            : 'text-text-tertiary hover:text-text-secondary'
                                    }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-2.5 pt-1">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={submitting}
                            className="flex-1 px-4 py-2.5 bg-[var(--color-surface)] border border-border text-text-secondary text-sm font-medium rounded-[10px] hover:bg-cream transition-colors duration-150 disabled:opacity-50"
                            data-cuelume-press
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !email.trim()}
                            className="flex-1 px-4 py-2.5 bg-coral text-white text-sm font-semibold rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-colors transition-transform duration-150 disabled:opacity-50 shadow-warm-sm"
                            data-cuelume-press
                        >
                            {submitting ? 'Sending...' : 'Send Invitation'}
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
        </div>
    );
}
