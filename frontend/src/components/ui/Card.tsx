import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  glow?: boolean
  interactive?: boolean
  gradientBorder?: boolean
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({
  children,
  glow = false,
  interactive = false,
  gradientBorder = false,
  className = '',
  padding = 'md',
  ...props
}: CardProps) {
  return (
    <div
      className={`
        relative bg-surface/60 backdrop-blur-xl
        border border-border rounded-2xl
        transition-all duration-300 ease-out
        ${paddingStyles[padding]}
        ${interactive
          ? 'cursor-pointer hover:border-border-hover hover:scale-[1.01] hover:shadow-xl hover:shadow-accent-glow'
          : 'hover:border-border-hover'
        }
        ${glow ? 'glow-accent' : ''}
        ${className}
      `}
      {...props}
    >
      {gradientBorder && (
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent rounded-t-2xl" />
      )}
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
  subtitle?: string
}

export function CardHeader({ children, className = '', subtitle }: CardHeaderProps) {
  return (
    <div className={`mb-5 ${className}`}>
      <h3 className="text-lg font-semibold text-text tracking-tight">{children}</h3>
      {subtitle && (
        <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
      )}
    </div>
  )
}

interface CardContentProps {
  children: ReactNode
  className?: string
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={className}>{children}</div>
}
