import { type TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-text-secondary mb-2"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full px-4 py-3
            bg-surface-2/60 backdrop-blur-sm
            border rounded-xl
            text-sm text-text
            placeholder:text-text-muted
            focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/30
            transition-all duration-200
            resize-y min-h-[120px]
            ${error
              ? 'border-danger/40 focus:ring-danger/30 focus:border-danger/30'
              : 'border-border hover:border-border-hover'
            }
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-danger">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-xs text-text-muted">{helperText}</p>
        )}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
