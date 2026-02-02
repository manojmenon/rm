import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, type User } from '@/lib/api';

type AuthState = {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string) => void;
  logout: () => void;
  login: (body: { email: string; password: string }) => Promise<void>;
  register: (body: { name: string; email: string; password: string }) => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', accessToken);
        }
        set({ user, accessToken });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
        }
        set({ user: null, accessToken: null });
      },
      login: async (body) => {
        const res = await api.auth.login(body);
        set({
          user: res.user,
          accessToken: res.access_token,
        });
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', res.access_token);
        }
      },
      register: async (body) => {
        const res = await api.auth.register(body);
        set({
          user: res.user,
          accessToken: res.access_token,
        });
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', res.access_token);
        }
      },
    }),
    { name: 'auth' }
  )
);
