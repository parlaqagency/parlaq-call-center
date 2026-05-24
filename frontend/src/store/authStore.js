import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('parlaq_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axios.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('parlaq_token');
      useAuthStore.getState().logout();
    }
    return Promise.reject(err);
  }
);

export const useAuthStore = create(
  persist(
    (set, get) => ({
      agent: null,
      token: null,
      isAdmin: false,
      isInitialLoading: true,
      setIsInitialLoading: (val) => set({ isInitialLoading: val }),

      login: async ({ extension, password }) => {
        const { data } = await axios.post('/api/auth/login', { extension, password });
        localStorage.setItem('parlaq_token', data.token);
        set({ agent: data.agent, token: data.token, isAdmin: data.agent.role === 'admin' });
        return data.agent;
      },

      adminLogin: async ({ email, password }) => {
        const { data } = await axios.post('/api/auth/admin-login', { email, password });
        localStorage.setItem('parlaq_token', data.token);
        set({ agent: data.agent, token: data.token, isAdmin: true });
        return data.agent;
      },

      logout: () => {
        localStorage.removeItem('parlaq_token');
        set({ agent: null, token: null, isAdmin: false });
      },

      refreshMe: async () => {
        try {
          const { data } = await axios.get('/api/auth/me');
          set({ agent: data, isAdmin: data.role === 'admin' });
        } catch (err) {
          // Sadece 401 (geçersiz token) durumunda logout yap,
          // network hatası veya sunucu kapalıysa kullanıcıyı atma
          if (err.response?.status === 401) get().logout();
        }
      },

      updateAgentStatus: (status, breakReason = null) => {
        set(s => ({ agent: s.agent ? { ...s.agent, status, break_reason: breakReason } : s.agent }));
      },

      setPassword: async ({ agentId, password, role }) => {
        await axios.post('/api/auth/set-password', { agentId, password, role });
      },
    }),
    { name: 'parlaq_auth', partialize: (s) => ({ agent: s.agent, token: s.token, isAdmin: s.isAdmin }) }
  )
);
