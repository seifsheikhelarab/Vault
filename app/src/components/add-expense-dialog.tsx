import { useCallback, useEffect, useState } from 'react';
import { useCreateExpense, useUpdateExpense } from '../lib/hooks';
import { CategoryPicker } from './category-picker';
import type { Expense } from '@expense/shared';

interface FormState {
    amount: string;
    description: string;
    categoryId: string;
    date: string;
}

const emptyForm: FormState = {
    amount: '',
    description: '',
    categoryId: '',
    date: new Date().toISOString().split('T')[0]
};

function formFromExpense(expense: Expense): FormState {
    return {
        amount: String(Number(expense.amount)),
        description: expense.description,
        categoryId: expense.categoryId,
        date: new Date(expense.date).toISOString().split('T')[0]
    };
}

interface AddExpenseDialogProps {
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    expense?: Expense | null;
}

export function AddExpenseDialog({
    open,
    onClose,
    onSuccess,
    expense
}: AddExpenseDialogProps) {
    const isEditing = !!expense;

    const [form, setForm] = useState<FormState>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [showCheck, setShowCheck] = useState(false);

    const createExpense = useCreateExpense();
    const updateExpense = useUpdateExpense();

    const updateField = useCallback(
        (field: keyof FormState, value: string) => {
            setForm((prev) => ({ ...prev, [field]: value }));
        },
        []
    );

    // Pre-fill fields when editing
    useEffect(() => {
        setForm(expense ? formFromExpense(expense) : emptyForm);
        setErrors({});
        setShowCheck(false);
    }, [expense, open]);

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

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.amount || parseFloat(form.amount) <= 0)
            errs.amount = 'Enter a valid amount';
        if (!form.description.trim())
            errs.description = 'Description is required';
        if (!form.categoryId) errs.category = 'Select a category';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        try {
            if (isEditing && expense) {
                await updateExpense.mutateAsync({
                    id: expense.id,
                    amount: parseFloat(form.amount),
                    description: form.description.trim(),
                    categoryId: form.categoryId,
                    date: new Date(form.date).toISOString()
                });
            } else {
                await createExpense.mutateAsync({
                    amount: parseFloat(form.amount),
                    description: form.description.trim(),
                    categoryId: form.categoryId,
                    date: new Date(form.date).toISOString()
                });
            }

            setShowCheck(true);
            setSubmitting(false);

            setTimeout(() => {
                onSuccess?.();
                handleClose();
            }, 900);
        } catch (err: any) {
            setErrors({
                submit: err?.message ?? `Failed to ${isEditing ? 'update' : 'create'} expense`
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
                            Expense {isEditing ? 'updated' : 'added'}!
                        </p>
                    </div>
                </div>
            )}

            {/* Dialog */}
            <div
                role="dialog"
                aria-modal="true"
                aria-label={isEditing ? 'Edit expense' : 'Add expense'}
                className="relative bg-surface rounded-[16px] shadow-warm-lg border border-border-light w-full max-w-sm overflow-hidden"
                style={{
                    animation: 'slideUp 0.3s cubic-bezier(0.22, 1, 0.36, 1)'
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border-light">
                    <h2 className="text-base font-semibold text-text-primary">
                        {isEditing ? 'Edit Expense' : 'Add Expense'}
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
                    {errors.submit && (
                        <div className="p-2.5 rounded-[8px] bg-error/10 border border-error/20 text-xs text-error font-medium">
                            {errors.submit}
                        </div>
                    )}

                    {/* Amount */}
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                            Amount
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary font-mono text-sm">
                                $
                            </span>
                            <input
                                autoFocus
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={form.amount}
                                onChange={(e) =>
                                    updateField('amount', e.target.value)
                                }
                                className={`w-full pl-7 pr-3 py-2 bg-surface border rounded-[8px] text-sm font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150 ${errors.amount ? 'border-error' : 'border-border'}`}
                            />
                        </div>
                        {errors.amount && (
                            <p className="text-xs text-error mt-1">
                                {errors.amount}
                            </p>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                            Description
                        </label>
                        <input
                            type="text"
                            placeholder="What was this for?"
                            value={form.description}
                            onChange={(e) =>
                                updateField('description', e.target.value)
                            }
                            className={`w-full px-3 py-2 bg-surface border rounded-[8px] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150 ${errors.description ? 'border-error' : 'border-border'}`}
                        />
                        {errors.description && (
                            <p className="text-xs text-error mt-1">
                                {errors.description}
                            </p>
                        )}
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                            Category
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                            <CategoryPicker
                                selectedId={form.categoryId}
                                onSelect={(id) => updateField('categoryId', id)}
                            />
                        </div>
                        {errors.category && (
                            <p className="text-xs text-error mt-1">
                                {errors.category}
                            </p>
                        )}
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                            Date
                        </label>
                        <input
                            type="date"
                            value={form.date}
                            onChange={(e) =>
                                updateField('date', e.target.value)
                            }
                            className="w-full px-3 py-2 bg-surface border border-border rounded-[8px] text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral transition-colors duration-150"
                        />
                    </div>

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
                            disabled={
                                submitting ||
                                !form.amount ||
                                !form.description.trim() ||
                                !form.categoryId
                            }
                            className="flex-1 px-4 py-2.5 bg-coral text-white text-sm font-semibold rounded-[10px] hover:bg-coral-dark active:scale-[0.98] transition-colors transition-transform duration-150 disabled:opacity-50 shadow-warm-sm"
                            data-cuelume-press
                        >
                            {submitting
                                ? isEditing
                                    ? 'Saving...'
                                    : 'Adding...'
                                : isEditing
                                  ? 'Save Changes'
                                  : 'Add Expense'}
                        </button>
                    </div>
                </form>

                {/* Quick option to full form — only show for create mode */}
                {!isEditing && (
                    <div className="px-5 pb-4">
                        <p className="text-[10px] text-text-tertiary text-center">
                            Need group split or receipt upload?{' '}
                            <a
                                href="/expenses/new"
                                onClick={() => handleClose()}
                                className="text-coral font-medium hover:underline inline cursor-pointer"
                            >
                                Open full form
                            </a>
                        </p>
                    </div>
                )}
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
