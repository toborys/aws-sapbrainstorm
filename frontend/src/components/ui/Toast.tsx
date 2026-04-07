import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useUiStore, type Toast } from '../../stores/uiStore'

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
}

const styleMap = {
  success: 'border-success/30 bg-success/10',
  error: 'border-danger/30 bg-danger/10',
  info: 'border-accent/30 bg-accent/10',
}

const iconColorMap = {
  success: 'text-success',
  error: 'text-danger',
  info: 'text-accent',
}

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useUiStore((s) => s.removeToast)
  const Icon = iconMap[toast.type]

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm min-w-[320px] max-w-[420px] ${styleMap[toast.type]}`}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${iconColorMap[toast.type]}`} />
      <p className="flex-1 text-sm text-text">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="p-0.5 rounded text-text-muted hover:text-text transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
