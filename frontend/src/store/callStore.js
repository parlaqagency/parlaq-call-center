import { create } from 'zustand';
import axios from 'axios';

export const useCallStore = create((set, get) => ({
  activeCalls: [],
  callHistory: [],
  todayStats: { total: 0, answered: 0, missed: 0, avg_duration: 0 },
  activeCall: null,

  fetchActiveCalls: async () => {
    const { data } = await axios.get('/api/calls/active');
    set({ activeCalls: data });
  },

  fetchHistory: async (params = {}) => {
    const { data } = await axios.get('/api/calls/history', { params });
    set({ callHistory: data });
  },

  fetchTodayStats: async () => {
    const { data } = await axios.get('/api/calls/today-stats');
    set({ todayStats: data });
  },

  startCall: async ({ customerPhone, extensionNumber, agentId }) => {
    const { data } = await axios.post('/api/calls/start', { customerPhone, extensionNumber, agentId });
    set({ activeCall: data });
    return data;
  },

  hangupCall: async () => {
    const call = get().activeCall;
    if (!call) return;
    await axios.post('/api/calls/hangup', {
      uniqueId: call.unique_id,
      crmId: call.unique_id,
      agentId: call.agent_id,
    });
    set({ activeCall: null });
    get().fetchActiveCalls();
    get().fetchTodayStats();
  },

  muteCall: async (state) => {
    const call = get().activeCall;
    if (!call) return;
    await axios.post('/api/calls/mute', { uniqueId: call.unique_id, crmId: call.unique_id, state });
  },

  transferCall: async (extension) => {
    const call = get().activeCall;
    if (!call) return;
    await axios.post('/api/calls/transfer', { uniqueId: call.unique_id, crmId: call.unique_id, extension });
  },

  myHistory: [],
  myStats: { total: 0, answered: 0, missed: 0, avg_duration: 0, talk_seconds: 0 },
  myHourly: [],

  fetchMyHistory: async () => {
    const { data } = await axios.get('/api/calls/my-history');
    set({ myHistory: data });
  },

  fetchMyStats: async () => {
    const { data } = await axios.get('/api/calls/my-stats');
    set({ myStats: data });
  },

  fetchMyHourly: async () => {
    const { data } = await axios.get('/api/calls/my-hourly');
    set({ myHourly: data });
  },

  addInboundCall: (data) => {
    set(s => ({
      activeCalls: [{ ...data, direction: 'inbound', status: 'ringing' }, ...s.activeCalls],
    }));
  },

  removeCall: (uniqueId) => {
    set(s => ({ activeCalls: s.activeCalls.filter(c => c.unique_id !== uniqueId) }));
  },

  callbacks: [],
  fetchCallbacks: async () => {
    const { data } = await axios.get('/api/calls/callbacks');
    set({ callbacks: data });
  },
}));
