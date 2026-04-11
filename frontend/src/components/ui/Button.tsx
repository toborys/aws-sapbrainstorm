import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  children: ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-gradient-to-r from-accent to-accent-hover text-white font-semibold',
    'shadow-lg shadow-accent/20',
    'hover:shadow-xl hover:shadow-accent/30 hover:brightness-110',
    'disabled:from-accent/50 disabled:to-accent-hover/50 disabled:shadow-none',
  ].join(' '),
  secondary: [
    'bg-surface-2/60 text-text border border-border backdrop-blur-sm',
    'hover:bg-surface-2 hover:border-border-hover hover:shadow-lg hover:shadow-accent-glow',
  ].join(' '),
  ghost: [
    'bg-transparent text-text-secondary',
    'hover:text-text hover:bg-surface-2/60',
  ].join(' '),
  danger: [
    'bg-danger/10 text-danger border border-danger/20',
    'hover:bg-danger/20 hover:border-danger/30',
  ].join(' '),
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-xl',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      className={`
        inline-flex items-center justify-center font-medium
        transition-all duration-200 ease-out
        cursor-pointer select-none
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin opacity-70" />
      ) : icon ? (
        <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
      ) : null}
      {children}
      {iconRight && !loading && (
        <span className="shrink-0 [&>svg]:w-4 [&>svg]:h-4">{iconRight}</span>
      )}
    </button>
  )
}
