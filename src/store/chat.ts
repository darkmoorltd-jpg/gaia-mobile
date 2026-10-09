import { create } from 'zustand';

interface ChatState {
  unreadTotal: number;
  setUnread: (n: number) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  unreadTotal: 0,
  setUnread: (n) => set({ unreadTotal: n }),
}));
