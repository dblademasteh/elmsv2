import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (user: User, token: string, refreshToken?: string | null) => void;
  setTokens: (token: string, refreshToken?: string | null) => void;
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
      refreshToken: null,
      isLoading: false,

      login: (user: User, token: string, refreshToken: string | null = null) => {
        set({ user, token, refreshToken, isLoading: false });
      },

      setTokens: (token: string, refreshToken: string | null = null) => {
        set({ token, refreshToken });
      },

      logout: () => {
        set({ user: null, token: null, refreshToken: null, isLoading: false });
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
      partialize: (state) => ({ user: state.user, token: state.token, refreshToken: state.refreshToken }),
    }
  )
);
