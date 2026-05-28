import { create } from 'zustand';
import axios from 'axios';

export const useCustomerStore = create((set, get) => ({
  customers: [],
  total: 0,
  page: 1,
  search: '',
  loading: false,
  selectedCustomer: null,
  customerCalls: [],

  fetchCustomers: async ({ search, page } = {}) => {
    const s = search !== undefined ? search : get().search;
    const p = page !== undefined ? page : get().page;
    set({ loading: true, search: s, page: p });
    const { data } = await axios.get('/api/customers', { params: { search: s, page: p, limit: 50 } });
    set({ customers: data.data, total: data.total, loading: false });
  },

  createCustomer: async (fields) => {
    const { data } = await axios.post('/api/customers', fields);
    set(s => ({ customers: [data, ...s.customers], total: s.total + 1 }));
    return data;
  },

  updateCustomer: async (id, fields) => {
    const { data } = await axios.put(`/api/customers/${id}`, fields);
    set(s => ({ customers: s.customers.map(c => c.id === id ? data : c) }));
    return data;
  },

  deleteCustomer: async (id) => {
    await axios.delete(`/api/customers/${id}`);
    set(s => ({ customers: s.customers.filter(c => c.id !== id), total: s.total - 1 }));
  },

  toggleBlacklist: async (id, phone, isBlacklisted) => {
    if (id) {
      const { data } = await axios.patch(`/api/customers/${id}/blacklist`, { is_blacklisted: isBlacklisted });
      set(s => ({
        customers: s.customers.map(c => c.id === id ? data : c),
        selectedCustomer: s.selectedCustomer?.id === id ? data : s.selectedCustomer
      }));
      return data;
    } else if (phone) {
      const { data } = await axios.post('/api/customers/blacklist', { phone, is_blacklisted: isBlacklisted });
      await get().fetchCustomers();
      return data;
    }
  },

  bulkImport: async (rows) => {
    const { data } = await axios.post('/api/customers/bulk', { rows });
    await get().fetchCustomers({ page: 1 });
    return data.imported;
  },

  selectCustomer: async (customer) => {
    set({ selectedCustomer: customer, customerCalls: [] });
    if (customer) {
      const { data } = await axios.get(`/api/customers/${customer.id}/calls`);
      set({ customerCalls: data });
    }
  },

  clearSelected: () => set({ selectedCustomer: null, customerCalls: [] }),
}));
