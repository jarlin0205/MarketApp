import { create } from 'zustand';

interface AuthState {
  user: any | null;
  role: 'client' | 'admin' | 'repartidor' | null;
  password?: string | null; // Phase 41: Para validar acciones locales de repartidores
  setUser: (user: any | null, role?: string, password?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  password: null,
  setUser: (user, role, password) => set({ 
    user, 
    role: (role as any) || 'client',
    password: password || null 
  }),
  logout: () => set({ user: null, role: null, password: null }),
}));
