import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

interface SummaryCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: ReactNode
  trend?: { value: string; positive: boolean }
}

export function SummaryCard({ title, value, subtitle, icon, trend }: SummaryCardProps) {
  return (
    <div className="bg-white rounded-[16px] p-6 shadow-warm-sm border border-border-light hover:shadow-warm-md transition-shadow duration-200">
      <div className="flex items-start justify-between mb-4">
        <span className="text-sm font-medium text-text-secondary">{title}</span>
        {icon && <span className="text-coral">{icon}</span>}
      </div>
      <div className="font-mono text-2xl font-bold text-text-primary tracking-tight">{value}</div>
      {(subtitle || trend) && (
        <div className="flex items-center gap-2 mt-2">
          {trend && (
            <span className={`text-xs font-semibold ${trend.positive ? 'text-success' : 'text-error'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {subtitle && <span className="text-xs text-text-tertiary">{subtitle}</span>}
        </div>
      )}
    </div>
  )
}

interface EmptyStateProps {
  title: string
  description: string
  action?: { label: string; to: string }
  icon?: ReactNode
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {icon && <div className="mb-5 text-coral opacity-60">{icon}</div>}
      <h3 className="text-lg font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">{description}</p>
      {action && (
        <Link
          to={action.to}
          data-cuelume-hover="tick"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-coral to-coral-dark text-white text-sm font-semibold rounded-[10px] hover:shadow-warm-md active:scale-[0.98] transition-all duration-200"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}

interface SkeletonProps {
  className?: string
  count?: number
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`t-skel ${className}`}>
      <div className="t-skel-skeleton is-pulsing">
        <div className="w-full h-full bg-cream rounded-[10px]" />
      </div>
      <div className="t-skel-content">
        <div className="w-full h-full bg-white rounded-[10px]" />
      </div>
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-[16px] p-6 shadow-warm-sm border border-border-light ${className}`}>
      {children}
    </div>
  )
}
