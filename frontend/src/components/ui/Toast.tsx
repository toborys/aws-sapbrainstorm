import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useUiStore, type Toast } from '../../stores/uiStore'

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const accentMap = {
  success: {
    border: 'border-success/20',
    bg: 'bg-success/5',
    icon: 'text-success',
    progress: 'bg-success',
  },
  error: {
    border: 'border-danger/20',
    bg: 'bg-danger/5',
    icon: 'text-danger',
    progress: 'bg-danger',
  },
  info: {
    border: 'border-accent/20',
    bg: 'bg-accent/5',
    icon: 'text-accent',
    progress: 'bg-accent',
  },
}

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useUiStore((s) => s.removeToast)
  const [isExiting, setIsExiting] = useState(false)
  const Icon = iconMap[toast.type]
  const style = accentMap[toast.type]
  const duration = toast.duration ?? 4000

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(() => removeToast(toast.id), 200)
  }

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(handleDismiss, duration)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className={`
        relative overflow-hidden
        flex items-start gap-3
        px-4 py-3.5 rounded-xl
        border ${style.border} ${style.bg}
        backdrop-blur-xl
        min-w-[340px] max-w-[440px]
        shadow-2xl shadow-black/30
        transition-all duration-200
        ${isExiting ? 'opacity-0 translate-x-8' : 'animate-slide-in-right'}
      `}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${style.icon}`} />
      <p className="flex-1 text-sm text-text leading-relaxed">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-2/60 transition-colors cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Auto-dismiss progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5">
          <div
            className={`h-full ${style.progress} opacity-40 animate-progress`}
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      )}
    </div>
  )
}

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2.5">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
