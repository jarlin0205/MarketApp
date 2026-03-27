import { create } from 'zustand';

interface AuthState {
  user: any | null;
  role: 'client' | 'admin' | 'repartidor' | null;
  setUser: (user: any | null, role?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  setUser: (user, role) => set({ user, role: (role as any) || 'client' }),
  logout: () => set({ user: null, role: null }),
}));
