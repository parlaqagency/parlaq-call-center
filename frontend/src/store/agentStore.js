import { create } from 'zustand';
import axios from 'axios';

export const useAgentStore = create((set) => ({
  agents: [],
  loading: false,

  fetchAgents: async () => {
    set({ loading: true });
    const { data } = await axios.get('/api/agents');
    set({ agents: data, loading: false });
  },

  createAgent: async (fields) => {
    const { data } = await axios.post('/api/agents', fields);
    set(s => ({ agents: [...s.agents, data] }));
    return data;
  },

  updateAgent: async (id, fields) => {
    const { data } = await axios.put(`/api/agents/${id}`, fields);
    set(s => ({ agents: s.agents.map(a => a.id === id ? data : a) }));
    return data;
  },

  deleteAgent: async (id) => {
    await axios.delete(`/api/agents/${id}`);
    set(s => ({ agents: s.agents.filter(a => a.id !== id) }));
  },

  loginAgent: async (id) => {
    await axios.post(`/api/agents/${id}/login`);
    set(s => ({ agents: s.agents.map(a => a.id === id ? { ...a, status: 'available' } : a) }));
  },

  logoffAgent: async (id) => {
    await axios.post(`/api/agents/${id}/logoff`);
    set(s => ({ agents: s.agents.map(a => a.id === id ? { ...a, status: 'offline' } : a) }));
  },

  pauseAgent: async (id, reason) => {
    await axios.post(`/api/agents/${id}/pause`, { reason });
    set(s => ({ agents: s.agents.map(a => a.id === id ? { ...a, status: 'break' } : a) }));
  },

  unpauseAgent: async (id) => {
    await axios.post(`/api/agents/${id}/unpause`);
    set(s => ({ agents: s.agents.map(a => a.id === id ? { ...a, status: 'available' } : a) }));
  },

  updateStatus: (id, status) => {
    set(s => ({ agents: s.agents.map(a => a.id === id ? { ...a, status } : a) }));
  },

  updateAgentStatus: (id, status, breakReason = null) => {
    set(s => ({ agents: s.agents.map(a => a.id === id ? { ...a, status, break_reason: breakReason } : a) }));
  },
}));
