import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>, durationMs?: number) => number;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast, durationMs = 2800) => {
    const id = ++counter;
    set({ toasts: [...get().toasts.slice(-3), { ...toast, id }] });
    if (durationMs > 0) setTimeout(() => get().dismiss(id), durationMs);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Notifications élégantes : toast.success('Plan importé ✓'). */
export const toast = {
  success: (message: string) => useToastStore.getState().push({ kind: 'success', message }),
  error: (message: string) => useToastStore.getState().push({ kind: 'error', message }, 4500),
  info: (message: string, action?: Toast['action'], durationMs?: number) =>
    useToastStore.getState().push({ kind: 'info', message, action }, durationMs ?? (action ? 8000 : 3000)),
};
