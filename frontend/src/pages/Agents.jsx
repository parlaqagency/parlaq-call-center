import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Key, Pencil, Trash2, UserCheck } from 'lucide-react';
import { useAgentStore } from '../store/agentStore';
import { useAuthStore } from '../store/authStore';
import SetPasswordModal from '../components/SetPasswordModal';

const STATUS = {
  available: { label: 'Müsait', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  busy: { label: 'Meşgul', dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200' },
  break: { label: 'Molada', dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  offline: { label: 'Çevrimdışı', dot: 'bg-slate-300', badge: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const BREAK_REASONS = ['Yemek Molası', 'Tuvalet', 'Toplantı', 'Teknik Sorun', 'Diğer'];

function AgentModal({ agent, onClose }) {
  const createAgent = useAgentStore(s => s.createAgent);
  const updateAgent = useAgentStore(s => s.updateAgent);
  const [form, setForm] = useState(agent || { name: '', extension: '', phone: '', email: '', queue: 'satis', sip_password: '' });

  const handle = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (!payload.sip_password) delete payload.sip_password;
    if (agent) await updateAgent(agent.id, payload);
    else await createAgent(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-slate-900 mb-5">{agent ? 'Çalışan Düzenle' : 'Yeni Çalışan'}</h3>
        <form onSubmit={handle} className="space-y-3">
          {[['Ad Soyad', 'name', 'text'], ['Dahili No', 'extension', 'text'], ['Telefon', 'phone', 'tel'], ['E-posta', 'email', 'email'], ['Kuyruk', 'queue', 'text']].map(([lbl, key, type]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">{lbl}</label>
              <input
                type={type}
                value={form[key] || ''}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required={['name', 'extension'].includes(key)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">SIP Şifresi</label>
            <input
              type="text"
              value={form.sip_password || ''}
              onChange={e => setForm(f => ({ ...f, sip_password: e.target.value }))}
              placeholder={agent?.sip_password ? '••••••••• (değiştirmek için yaz)' : 'Netsantral SIP şifresi'}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors">İptal</button>
            <button type="submit" className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors">Kaydet</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function AgentRow({ agent }) {
  const loginAgent = useAgentStore(s => s.loginAgent);
  const logoffAgent = useAgentStore(s => s.logoffAgent);
  const pauseAgent = useAgentStore(s => s.pauseAgent);
  const unpauseAgent = useAgentStore(s => s.unpauseAgent);
  const deleteAgent = useAgentStore(s => s.deleteAgent);
  const isAdmin = useAuthStore(s => s.isAdmin);
  const [editing, setEditing] = useState(false);
  const [showBreak, setShowBreak] = useState(false);
  const [showSetPw, setShowSetPw] = useState(false);

  const st = STATUS[agent.status] || STATUS.offline;

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {agent.name.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900">{agent.name}</div>
              <div className="text-xs text-slate-400">{agent.email || '—'}</div>
            </div>
          </div>
        </td>
        <td className="px-5 py-3.5 font-mono text-slate-600 text-sm">{agent.extension}</td>
        <td className="px-5 py-3.5">
          <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${st.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </span>
        </td>
        <td className="px-5 py-3.5 text-slate-500 text-sm">{agent.queue || '—'}</td>
        <td className="px-5 py-3.5">
          <div className="flex gap-1.5 flex-wrap">
            {agent.status === 'offline' && (
              <button onClick={() => loginAgent(agent.id)} className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors">Giriş</button>
            )}
            {agent.status === 'available' && (
              <>
                <button onClick={() => setShowBreak(true)} className="px-2.5 py-1 bg-violet-50 border border-violet-200 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-100 transition-colors">Mola</button>
                <button onClick={() => logoffAgent(agent.id)} className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors">Çıkış</button>
              </>
            )}
            {agent.status === 'break' && (
              <button onClick={() => unpauseAgent(agent.id)} className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors">Moladan Dön</button>
            )}
            <button onClick={() => setEditing(true)} className="p-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition-colors">
              <Pencil size={13} />
            </button>
            {isAdmin && (
              <button onClick={() => setShowSetPw(true)} className="p-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition-colors">
                <Key size={13} />
              </button>
            )}
            {isAdmin && (
              <button onClick={() => deleteAgent(agent.id)} className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {editing && <AgentModal agent={agent} onClose={() => setEditing(false)} />}
      {showSetPw && <SetPasswordModal agent={agent} onClose={() => setShowSetPw(false)} />}
      {showBreak && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowBreak(false)}>
          <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} className="bg-white border border-slate-200 rounded-2xl p-5 w-72 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Mola Sebebi</h3>
            <div className="space-y-1.5">
              {BREAK_REASONS.map(r => (
                <button key={r} onClick={() => { pauseAgent(agent.id, r); setShowBreak(false); }}
                  className="w-full py-2.5 px-3 text-left bg-slate-50 hover:bg-slate-100 rounded-lg text-sm text-slate-700 font-medium transition-colors">
                  {r}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

export default function Agents() {
  const { agents, fetchAgents } = useAgentStore();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { fetchAgents(); }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <UserCheck size={18} className="text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-900">Çalışanlar</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{agents.length}</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-lg text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
        >
          <Plus size={15} />
          Çalışan Ekle
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3">Ad</th>
              <th className="px-5 py-3">Dahili</th>
              <th className="px-5 py-3">Durum</th>
              <th className="px-5 py-3">Kuyruk</th>
              <th className="px-5 py-3">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {agents.map(a => <AgentRow key={a.id} agent={a} />)}
            </AnimatePresence>
            {agents.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-sm">
                  Henüz çalışan eklenmemiş
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && <AgentModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
