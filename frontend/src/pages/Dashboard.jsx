import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneIncoming, PhoneMissed, Clock, Users, Radio } from 'lucide-react';
import { io } from 'socket.io-client';
import { useCallStore } from '../store/callStore';
import { useAgentStore } from '../store/agentStore';

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-900 tabular-nums">{value ?? '—'}</div>
      {sub && <div className="text-xs text-slate-400 mt-1.5">{sub}</div>}
    </motion.div>
  );
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function maskPhone(phone) {
  if (!phone) return '—';
  return phone;
}

function LiveTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const base = startedAt ? new Date(startedAt).getTime() : Date.now();
    const update = () => setElapsed(Math.floor((Date.now() - base) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <span className="tabular-nums font-mono text-emerald-600 text-xs font-semibold">
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

function AgentWallCard({ agent, callMeta }) {
  const isBusy = agent.status === 'busy';
  const isBreak = agent.status === 'break';
  const isAvailable = agent.status === 'available';
  const meta = callMeta[agent.id];

  const cardStyle = isBusy
    ? {
        boxShadow: '0 0 18px rgba(34,197,94,0.12), 0 1px 4px rgba(0,0,0,0.05)',
        border: '1px solid rgba(16,185,129,0.35)',
        background: '#fff',
      }
    : isBreak
    ? {
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        border: '1px solid rgba(251,191,36,0.35)',
        background: '#fffbeb',
      }
    : {
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        border: '1px solid #f1f5f9',
        background: '#fff',
      };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={cardStyle}
      className="rounded-xl p-4 relative overflow-hidden"
    >
      {isBusy && (
        <motion.div
          className="absolute inset-0 rounded-xl pointer-events-none"
          animate={{ opacity: [0, 0.06, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(34,197,94,0.4), transparent 70%)' }}
        />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{agent.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">Dahili {agent.extension}</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5 mt-0.5">
          {isBusy && (
            <motion.span
              className="w-2 h-2 rounded-full bg-emerald-500"
              animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          )}
          {isBreak && <span className="w-2 h-2 rounded-full bg-amber-400" />}
          {isAvailable && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
          {!isBusy && !isBreak && !isAvailable && <span className="w-2 h-2 rounded-full bg-slate-300" />}
        </div>
      </div>

      <div className="mt-3">
        {isBusy && meta ? (
          <div className="space-y-1">
            <p className="text-xs text-slate-500 font-medium">{maskPhone(meta.phone)}</p>
            <div className="flex items-center gap-1.5">
              <Phone size={10} className="text-emerald-500 flex-shrink-0" />
              <LiveTimer startedAt={meta.startedAt} />
            </div>
          </div>
        ) : isBusy ? (
          <div className="flex items-center gap-1.5">
            <Phone size={10} className="text-emerald-500 flex-shrink-0" />
            <span className="text-xs text-emerald-600 font-semibold">Görüşmede</span>
          </div>
        ) : isBreak ? (
          <p className="text-xs text-amber-600 font-medium truncate">
            Molada {agent.break_reason ? `(${agent.break_reason})` : ''}
          </p>
        ) : isAvailable ? (
          <p className="text-xs text-emerald-500 font-medium">Çağrı Bekliyor</p>
        ) : (
          <p className="text-xs text-slate-400">Çevrimdışı</p>
        )}
      </div>
    </motion.div>
  );
}

function LiveWallboard({ agents, callMeta }) {
  const sorted = [...agents].sort((a, b) => {
    const order = { busy: 0, available: 1, break: 2, offline: 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });

  const busyCount = agents.filter(a => a.status === 'busy').length;
  const availableCount = agents.filter(a => a.status === 'available').length;
  const breakCount = agents.filter(a => a.status === 'break').length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Radio size={14} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Canlı İzleme</h2>
            <p className="text-xs text-slate-400">{agents.length} ajan</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-500">{busyCount} görüşmede</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-slate-500">{availableCount} müsait</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-xs text-slate-500">{breakCount} molada</span>
          </div>
        </div>
      </div>

      <div className="p-4">
        {sorted.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">Ajan bulunamadı</div>
        ) : (
          <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            <AnimatePresence>
              {sorted.map(agent => (
                <AgentWallCard key={agent.id} agent={agent} callMeta={callMeta} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const stats = useCallStore(s => s.todayStats);
  const fetchTodayStats = useCallStore(s => s.fetchTodayStats);
  const fetchAgents = useAgentStore(s => s.fetchAgents);
  const allAgents = useAgentStore(s => s.agents);
  const agents = allAgents.filter(a => a.role !== 'admin');
  const socketRef = useRef(null);
  const [callMeta, setCallMeta] = useState({});

  useEffect(() => {
    fetchTodayStats();
    fetchAgents();
    const id = setInterval(fetchTodayStats, 30000);

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001');
    socketRef.current = socket;

    socket.on('agent_status_changed', ({ agentId, status, break_reason, callPhone, callStartedAt }) => {
      useAgentStore.getState().updateAgentStatus(agentId, status, break_reason || null);
      if (status === 'busy' && callPhone) {
        setCallMeta(prev => ({ ...prev, [agentId]: { phone: callPhone, startedAt: callStartedAt || new Date().toISOString() } }));
      } else if (status !== 'busy') {
        setCallMeta(prev => { const n = { ...prev }; delete n[agentId]; return n; });
      }
    });

    socket.on('campaign_call_started', ({ extension, phone }) => {
      const agent = useAgentStore.getState().agents.find(a => a.extension === extension);
      if (agent) {
        setCallMeta(prev => ({ ...prev, [agent.id]: { phone, startedAt: new Date().toISOString() } }));
      }
    });

    return () => {
      clearInterval(id);
      socket.disconnect();
    };
  }, []);

  const online = agents.filter(a => a.status !== 'offline').length;
  const busy = agents.filter(a => a.status === 'busy').length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard label="Bugün Toplam" value={stats.total} icon={Phone} color="bg-slate-100 text-slate-600" />
        <StatCard label="Cevaplanan" value={stats.answered} icon={PhoneIncoming} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Cevapsız" value={stats.missed} icon={PhoneMissed} color="bg-red-50 text-red-500" />
        <StatCard label="Ort. Süre" value={formatDuration(stats.avg_duration)} icon={Clock} color="bg-blue-50 text-blue-600" sub="dakika:saniye" />
        <StatCard label="Çevrimiçi" value={`${online}/${agents.length}`} icon={Users} color="bg-violet-50 text-violet-600" sub={`${busy} meşgul`} />
      </div>

      <LiveWallboard agents={agents} callMeta={callMeta} />
    </div>
  );
}
