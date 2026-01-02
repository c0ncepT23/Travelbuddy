import { create } from 'zustand';

export type YoriState = 'IDLE' | 'THINKING' | 'CELEBRATING' | 'SLEEPING' | 'ANNOYED' | 'HAPPY';

interface YoriStore {
  currentState: YoriState;
  message: string | null;
  setYoriState: (state: YoriState, message?: string | null) => void;
  resetToIdle: () => void;
}

export const useYoriStore = create<YoriStore>((set) => ({
  currentState: 'IDLE',
  message: null,
  setYoriState: (state, message = null) => set({ currentState: state, message }),
  resetToIdle: () => set({ currentState: 'IDLE', message: null }),
}));

