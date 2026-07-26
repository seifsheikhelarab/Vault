import type { ReactNode } from 'react'

interface SideCardProps {
  label: string
  value: string
  icon: ReactNode
  revealed: boolean
  delay: number
}

export function SideCard({ label, value, icon, revealed, delay }: SideCardProps) {
  return (
    <div
      className="bg-white rounded-card p-5 shadow-warm-sm border border-border-light hover:shadow-warm-md transition-shadow duration-300"
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : 'translateY(12px)',
        transition: `all 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${0.15 + delay * 0.08}s`,
      }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-[10px] bg-warm-white flex items-center justify-center border border-border-light">
          {icon}
        </div>
        <span className="text-xs font-medium text-text-tertiary">{label}</span>
      </div>
      <div className="font-mono text-xl font-bold text-text-primary tracking-tight">{value}</div>
    </div>
  )
}
