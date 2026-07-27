import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useCreateGroup, useCreateOrganization } from '../lib/hooks';

interface CreateGroupDialogProps {
    open: boolean;
    onClose: () => void;
    /** If true, only show department kind (for company/expense context) */
    kind?: 'social' | 'department';
}

export function CreateGroupDialog({
    open,
    onClose,
    kind
}: CreateGroupDialogProps) {
    const [name, setName] = useState('');
    const [groupKind, setGroupKind] = useState<'social' | 'department'>(
        kind ?? 'social'
    );
    const [submitting, setSubmitting] = useState(false);
    const [showCheck, setShowCheck] = useState(false);

    const navigate = useNavigate();
    const createGroup = useCreateGroup();
    const createOrganization = useCreateOrganization();

    const handleClose = useCallback(() => {
        if (submitting) return;
        onClose();
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || submitting) return;

        setSubmitting(true);
        try {
            if (groupKind === 'department') {
                // Create a Better Auth organization for departments
                const org = await createOrganization.mutateAsync({
                    name: name.trim(),
                    slug:
                        name.trim().toLowerCase().replace(/\s+/g, '-') +
                        '-' +
                        Date.now().toString(36)
                });

                // Also create a custom group so expense tracking (budgets, claims) works
                createGroup.mutate(
                    { name: name.trim(), kind: 'department' },
                    {
                        onSuccess: () => {
                            setShowCheck(true);
                            setSubmitting(false);
                            setTimeout(() => {
                                handleClose();
                                navigate({ to: '/company' });
                            }, 900);
                        },
                        onError: () => {
                            // Org was created but group failed — still navigate
                            setShowCheck(true);
                            setSubmitting(false);
                            setTimeout(() => {
                                handleClose();
                                navigate({ to: '/company' });
                            }, 900);
                        }
                    }
                );
            } else {
                // Use the existing custom group system for social groups
                createGroup.mutate(
                    { name: name.trim(), kind: groupKind },
                    {
                        onSuccess: (group) => {
                            setShowCheck(true);
                            setSubmitting(false);
                            setTimeout(() => {
                                handleClose();
                                navigate({
                                    to: '/groups/$groupId',
                                    params: { groupId: group.id }
                                });
                            }, 900);
                        },
                        onError: () => {
                            setSubmitting(false);
                        }
                    }
                );
            }
        } catch {
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
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

            {/* Success overlay */}
            {showCheck && (
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
                            {groupKind === 'department'
                                ? 'Department created!'
                                : 'Group created!'}
                        </p>
                    </div>
                </div>
            )}

            {/* Dialog */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Create group"
                className="relative bg-surface rounded-[16px] shadow-warm-lg border border-border-light w-full max-w-sm overflow-hidden"
                style={{
                    animation: 'slideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border-light">
                    <h2 className="text-base font-semibold text-text-primary">
                        {groupKind === 'department'
                            ? 'Create Department'
                            : 'Create Group'}
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

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
                    {/* Group Name */}
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                            Name
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={
                                groupKind === 'department'
                                    ? 'e.g. Engineering, Marketing'
                                    : 'e.g. Roommates, Trip to Tokyo'
                            }
                            className="w-full px-3 py-2 bg-surface border border-border rounded-[8px] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                        />
                    </div>

                    {/* Type (only show if not pre-set) */}
                    {!kind && (
                        <div>
                            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                                Type
                            </label>
                            <div className="flex gap-2 p-1 bg-cream/60 rounded-[8px]">
                                {(['social', 'department'] as const).map(
                                    (opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => {
                                                setGroupKind(opt);
                                                setName('');
                                            }}
                                            data-cuelume-toggle
                                            className={`flex-1 py-2 px-3 rounded-[6px] text-xs font-medium transition-colors duration-150 ${
                                                groupKind === opt
                                                    ? 'bg-white text-text-primary shadow-warm-sm'
                                                    : 'text-text-tertiary hover:text-text-secondary'
                                            }`}
                                        >
                                            {opt === 'social'
                                                ? 'Social'
                                                : 'Department'}
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {/* Description hint */}
                    <p className="text-xs text-text-tertiary leading-relaxed">
                        {groupKind === 'social'
                            ? 'Split expenses with friends, roommates, or travel buddies.'
                            : 'Manage budgets and expense claims for your team.'}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2.5 pt-1">
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={submitting}
                            className="flex-1 px-4 py-2.5 bg-white border border-border text-text-secondary text-sm font-medium rounded-[10px] hover:bg-cream transition-colors duration-150 disabled:opacity-50"
                            data-cuelume-press
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !name.trim()}
                            className="flex-1 px-4 py-2.5 bg-coral text-white text-sm font-semibold rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-colors transition-transform duration-150 disabled:opacity-50 shadow-warm-sm"
                            data-cuelume-press
                        >
                            {submitting
                                ? 'Creating...'
                                : groupKind === 'department'
                                  ? 'Create Department'
                                  : 'Create Group'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Animations */}
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
