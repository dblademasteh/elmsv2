import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,

      login: (user: User, token: string) => {
        set({ user, token, isLoading: false });
      },

      logout: () => {
        set({ user: null, token: null, isLoading: false });
      },

      setUser: (user: User) => {
        set({ user });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      isAuthenticated: () => {
        const { token, user } = get();
        return !!token && !!user;
      },
    }),
    {
      name: 'lms-auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);