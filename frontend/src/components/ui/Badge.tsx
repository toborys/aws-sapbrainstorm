import type { ReactNode } from 'react'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'accent' | 'category'
type BadgeSize = 'sm' | 'md' | 'lg'

interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  children: ReactNode
  className?: string
  categoryColor?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  success:
    'bg-success/10 text-success border-success/20 backdrop-blur-sm',
  warning:
    'bg-warning/10 text-warning border-warning/20 backdrop-blur-sm',
  danger:
    'bg-danger/10 text-danger border-danger/20 backdrop-blur-sm',
  info:
    'bg-accent/10 text-accent border-accent/20 backdrop-blur-sm',
  default:
    'bg-surface-2/80 text-text-secondary border-border backdrop-blur-sm',
  accent:
    'bg-accent-glow text-accent border-accent/20 backdrop-blur-sm',
  category:
    'bg-surface-2/80 text-text-secondary border-border backdrop-blur-sm',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
}

export function Badge({
  variant = 'default',
  size = 'sm',
  children,
  className = '',
  categoryColor,
}: BadgeProps) {
  const isCategory = variant === 'category'

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium border
        transition-all duration-200 hover:border-border-hover
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${isCategory ? 'pl-1' : ''}
        ${className}
      `}
    >
      {isCategory && (
        <span
          className="w-1.5 h-3 rounded-full shrink-0"
          style={{ backgroundColor: categoryColor || 'var(--color-accent)' }}
        />
      )}
      {children}
    </span>
  )
}
