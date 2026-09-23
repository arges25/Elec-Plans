import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  message?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  inputMode?: 'text' | 'decimal';
  validate?: (value: string) => string | null;
}

type DialogRequest =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

interface DialogState {
  current: DialogRequest | null;
  open: (req: DialogRequest) => void;
  close: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  current: null,
  open: (req) => set({ current: req }),
  close: () => set({ current: null }),
}));

/** Demande une confirmation (ex. « Supprimer définitivement Maison Martin ? »). */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => useDialogStore.getState().open({ kind: 'confirm', options, resolve }));
}

export function promptDialog(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => useDialogStore.getState().open({ kind: 'prompt', options, resolve }));
}
