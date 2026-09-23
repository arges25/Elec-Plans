import { create } from 'zustand';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface SaveStatusState {
  status: SaveStatus;
  lastSavedAt?: number;
  setStatus: (status: SaveStatus) => void;
}

export const useSaveStatus = create<SaveStatusState>((set) => ({
  status: 'idle',
  setStatus: (status) => set(status === 'saved' ? { status, lastSavedAt: Date.now() } : { status }),
}));
