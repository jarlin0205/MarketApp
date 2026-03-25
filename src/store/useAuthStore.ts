import { create } from 'zustand';

interface AuthState {
  user: any | null;
  isAdmin: boolean;
  setUser: (user: any | null) => void;
  setAdmin: (isAdmin: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAdmin: false,
  setUser: (user) => set({ user }),
  setAdmin: (isAdmin) => set({ isAdmin }),
  logout: () => set({ user: null, isAdmin: false }),
}));
