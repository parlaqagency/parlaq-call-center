import { useEffect, useState } from 'react';
import { Search, Phone, ArrowRightLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAgentStore } from '../store/agentStore';
import { useCallStore } from '../store/callStore';
import { useCustomerStore } from '../store/customerStore';
import { useAuthStore } from '../store/authStore';
import { useSipStore } from '../store/sipStore';
import CallDialer from '../components/Calls/CallDialer';
import CallHistory from '../components/Calls/CallHistory';
import axios from 'axios';

function CustomerQuickList({ onCall }) {
  const { customers, fetchCustomers } = useCustomerStore();
  const [search, setSearch] = useState('');

  useEffect(() => { fetchCustomers({ page: 1 }); }, []);

  const handleSearch = (v) => {
    setSearch(v);
    clearTimeout(window._cqtimer);
    window._cqtimer = setTimeout(() => fetchCustomers({ search: v, page: 1 }), 300);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col h-full max-h-[420px] shadow-sm">
      <div className="px-4 py-3.5 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-900 mb-2.5">Müşteri Listesi</h3>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Ad veya telefon ara..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-400 placeholder:text-slate-400"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {customers.length === 0 && (
          <div className="text-center text-slate-400 text-xs py-8">Müşteri bulunamadı</div>
        )}
        {customers.map(c => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 group transition-colors">
            <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {(c.name || c.phone).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-900 truncate">{c.name} {c.surname}</div>
              <div className="text-xs font-mono text-slate-400">{c.phone}</div>
            </div>
            <button
              onClick={() => onCall(c.phone)}
              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2.5 py-1 bg-slate-900 rounded-lg text-xs text-white transition-all"
            >
              <Phone size={11} />
              Ara
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Calls() {
  const agents = useAgentStore(s => s.agents);
  const isAdmin = useAuthStore(s => s.isAdmin);
  const availableAgent = agents.find(a => a.status === 'available');
  const [dialPhone, setDialPhone] = useState('');

  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <CallDialer
            isAdmin={isAdmin}
            agentId={availableAgent?.id}
            agentExtension={availableAgent?.extension || '101'}
            prefillPhone={dialPhone}
            onPhoneUsed={() => setDialPhone('')}
          />
          <CallHistory />
        </div>
        <div>
          <CustomerQuickList onCall={setDialPhone} />
        </div>
      </div>
    </div>
  );
}
