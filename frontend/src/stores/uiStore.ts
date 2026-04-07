import { create } from 'zustand'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  duration?: number
}

interface UiState {
  toasts: Toast[]
  activeModal: string | null
  modalData: unknown

  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  openModal: (modalId: string, data?: unknown) => void
  closeModal: () => void
}

let toastCounter = 0

export const useUiStore = create<UiState>((set, get) => ({
  toasts: [],
  activeModal: null,
  modalData: null,

  addToast: (toast) => {
    const id = `toast-${++toastCounter}`
    const newToast = { ...toast, id }
    set({ toasts: [...get().toasts, newToast] })

    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, duration)
    }
  },

  removeToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },

  openModal: (modalId, data) => set({ activeModal: modalId, modalData: data }),

  closeModal: () => set({ activeModal: null, modalData: null }),
}))
