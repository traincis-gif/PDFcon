import { create } from 'zustand';
import type { User } from '@/types';

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,

  setAuth: (token: string, user: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pdflow_token', token);
      localStorage.setItem('pdflow_user', JSON.stringify(user));
    }
    set({ token, user });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pdflow_token');
      localStorage.removeItem('pdflow_user');
    }
    set({ token: null, user: null });
  },

  hydrate: () => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('pdflow_token');
      const userStr = localStorage.getItem('pdflow_user');
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr) as User;
          set({ token, user });
        } catch {
          set({ token: null, user: null });
        }
      }
    }
  },
}));
