import { create } from 'zustand';
import axios from 'axios';

export const useAppointmentStore = create((set, get) => ({
  appointments: [],
  loading: false,

  fetchAppointments: async (params = {}) => {
    set({ loading: true });
    try {
      const { data } = await axios.get('/api/appointments', { params });
      set({ appointments: data });
    } finally {
      set({ loading: false });
    }
  },

  createAppointment: async (fields) => {
    const { data } = await axios.post('/api/appointments', fields);
    set(s => ({ appointments: [data, ...s.appointments] }));
    return data;
  },

  updateStatus: async (id, status) => {
    const { data } = await axios.patch(`/api/appointments/${id}/status`, { status });
    set(s => ({ appointments: s.appointments.map(a => a.id === id ? data : a) }));
  },

  updateAppointment: async (id, fields) => {
    const { data } = await axios.put(`/api/appointments/${id}`, fields);
    set(s => ({ appointments: s.appointments.map(a => a.id === id ? data : a) }));
    return data;
  },

  deleteAppointment: async (id) => {
    await axios.delete(`/api/appointments/${id}`);
    set(s => ({ appointments: s.appointments.filter(a => a.id !== id) }));
  },
}));
