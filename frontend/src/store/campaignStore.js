import { create } from 'zustand';
import axios from 'axios';

export const useCampaignStore = create((set, get) => ({
  campaigns: [],
  loading: false,

  fetchCampaigns: async () => {
    set({ loading: true });
    try {
      const { data } = await axios.get('/api/campaigns');
      set({ campaigns: data });
    } finally {
      set({ loading: false });
    }
  },

  createCampaign: async ({ name, contacts, notes }) => {
    const { data } = await axios.post('/api/campaigns', { name, contacts, notes });
    set(s => ({ campaigns: [data, ...s.campaigns] }));
    return data;
  },

  startCampaign: async (id) => {
    const { data } = await axios.post(`/api/campaigns/${id}/start`);
    set(s => ({ campaigns: s.campaigns.map(c => c.id === id ? { ...c, ...data } : c) }));
  },

  pauseCampaign: async (id) => {
    const { data } = await axios.post(`/api/campaigns/${id}/pause`);
    set(s => ({ campaigns: s.campaigns.map(c => c.id === id ? { ...c, ...data } : c) }));
  },

  stopCampaign: async (id) => {
    await axios.post(`/api/campaigns/${id}/stop`);
    set(s => ({ campaigns: s.campaigns.map(c => c.id === id ? { ...c, status: 'stopped' } : c) }));
  },

  deleteCampaign: async (id) => {
    await axios.delete(`/api/campaigns/${id}`);
    set(s => ({ campaigns: s.campaigns.filter(c => c.id !== id) }));
  },

  updateStats: (campaignId, stats) => {
    set(s => ({
      campaigns: s.campaigns.map(c =>
        c.id === campaignId ? { ...c, ...stats } : c
      ),
    }));
  },

  markCompleted: (campaignId) => {
    set(s => ({
      campaigns: s.campaigns.map(c =>
        c.id === campaignId ? { ...c, status: 'completed' } : c
      ),
    }));
  },
}));
