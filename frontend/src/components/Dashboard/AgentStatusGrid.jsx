import { motion } from 'framer-motion';
import { useAgentStore } from '../../store/agentStore';

const STATUS = {
  available: { label: 'Müsait', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  busy: { label: 'Meşgul', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200' },
  break: { label: 'Molada', dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  offline: { label: 'Çevrimdışı', dot: 'bg-slate-300', badge: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function AgentCard({ agent }) {
  const s = STATUS[agent.status] || STATUS.offline;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-xl p-3.5 hover:shadow-sm transition-shadow"
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
          {agent.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-900 truncate">{agent.name}</div>
          <div className="text-xs text-slate-400">Dahili {agent.extension}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${s.badge}`}>
          {agent.status === 'break' && agent.break_reason ? `Mola · ${agent.break_reason}` : s.label}
        </span>
      </div>
    </motion.div>
  );
}

export default function AgentStatusGrid() {
  const agents = useAgentStore(s => s.agents);

  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Çalışanlar</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {agents.map(a => <AgentCard key={a.id} agent={a} />)}
        {agents.length === 0 && (
          <div className="col-span-full text-slate-400 text-sm text-center py-10 border border-dashed border-slate-200 rounded-xl">
            Henüz çalışan eklenmemiş
          </div>
        )}
      </div>
    </div>
  );
}
