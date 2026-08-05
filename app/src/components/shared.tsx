import { Link } from '@tanstack/react-router';
import type { ReactNode, ButtonHTMLAttributes } from 'react';

/* ── Button ─────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
    variant?: ButtonVariant;
    size?: 'sm' | 'md';
    children: ReactNode;
    className?: string;
    to?: string;
    onClick?: () => void;
    disabled?: boolean;
    type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
    icon?: ReactNode;
    ariaLabel?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary:
        'bg-coral text-white hover:bg-coral-dark shadow-warm-sm hover:shadow-warm-md active:scale-[0.98]',
    secondary:
        'bg-[var(--color-surface)] text-text-secondary border border-border hover:bg-cream hover:text-text-primary shadow-warm-sm',
    ghost: 'text-text-secondary hover:text-text-primary hover:bg-cream/80',
    danger: 'bg-error text-white hover:bg-error/80 shadow-warm-sm active:scale-[0.98]'
};

const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs font-semibold rounded-[8px]',
    md: 'px-5 py-2.5 text-sm font-medium rounded-[10px]'
};

export function Button({
    variant = 'primary',
    size = 'md',
    children,
    className = '',
    to,
    onClick,
    disabled = false,
    type,
    icon,
    ariaLabel
}: ButtonProps) {
    const classes = `inline-flex items-center justify-center gap-2 transition-colors transition-shadow transition-transform duration-150 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

    if (to) {
        return (
            <Link
                to={to}
                className={classes}
                aria-label={ariaLabel}
                data-cuelume-press
            >
                {icon && <span>{icon}</span>}
                {children}
            </Link>
        );
    }

    return (
        <button
            type={type ?? 'button'}
            onClick={onClick}
            disabled={disabled}
            className={classes}
            aria-label={ariaLabel}
            data-cuelume-press
        >
            {icon && <span>{icon}</span>}
            {children}
        </button>
    );
}

/* ── IconButton (icon-only with required ariaLabel) ────── */

interface IconButtonProps {
    onClick?: () => void;
    ariaLabel: string;
    children: ReactNode;
    className?: string;
    disabled?: boolean;
}

export function IconButton({
    onClick,
    ariaLabel,
    children,
    className = '',
    disabled = false
}: IconButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={ariaLabel}
            data-cuelume-press
            className={`p-1.5 rounded-[6px] text-text-tertiary hover:text-text-primary hover:bg-cream/60 transition-colors duration-200 ${className}`}
        >
            {children}
        </button>
    );
}

/* ── SummaryCard ────────────────────────────────────────── */

interface SummaryCardProps {
    title: string;
    value: string;
    subtitle?: string;
    icon?: ReactNode;
    trend?: { value: string; positive: boolean };
}

export function SummaryCard({
    title,
    value,
    subtitle,
    icon,
    trend
}: SummaryCardProps) {
    return (
        <div className="border-b border-border-light pb-5 last:border-0">
            <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-medium text-text-secondary">
                    {title}
                </span>
                {icon && <span className="text-coral">{icon}</span>}
            </div>
            <div className="text-2xl font-bold text-text-primary tracking-tight">
                {value}
            </div>
            {(subtitle || trend) && (
                <div className="flex items-center gap-2 mt-2">
                    {trend && (
                        <span
                            className={`text-xs font-semibold ${trend.positive ? 'text-success' : 'text-error'}`}
                        >
                            {trend.positive ? '↑' : '↓'} {trend.value}
                        </span>
                    )}
                    {subtitle && (
                        <span className="text-xs text-text-tertiary">
                            {subtitle}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

/* ── EmptyState ─────────────────────────────────────────── */

interface EmptyStateProps {
    title: string;
    description: string;
    action?: { label: string; to: string };
    icon?: ReactNode;
}

export function EmptyState({
    title,
    description,
    action,
    icon
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            {icon && <div className="mb-5 text-coral/60">{icon}</div>}
            <h3 className="text-lg font-semibold text-text-primary mb-2">
                {title}
            </h3>
            <p className="text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">
                {description}
            </p>
            {action && <Button to={action.to}>{action.label}</Button>}
        </div>
    );
}

/* ── Skeleton ───────────────────────────────────────────── */

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <div className={`t-skel ${className}`}>
            <div className="t-skel-skeleton is-pulsing">
                <div className="w-full h-full bg-cream rounded-[10px]" />
            </div>
            <div className="t-skel-content">
                <div className="w-full h-full bg-[var(--color-surface)] rounded-[10px]" />
            </div>
        </div>
    );
}

/* ── Card ───────────────────────────────────────────────── */

export function Card({
    children,
    className = ''
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`border-b border-border-light pb-6 last:border-0 ${className}`}
        >
            {children}
        </div>
    );
}
