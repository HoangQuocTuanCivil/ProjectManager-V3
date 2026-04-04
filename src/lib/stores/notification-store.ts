import { create } from 'zustand';

interface NotifState {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  decrement: () => void;
}

export const useNotifStore = create<NotifState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  decrement: () => set((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1) })),
}));
