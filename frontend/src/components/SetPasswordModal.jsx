import { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, X, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function SetPasswordModal({ agent, onClose }) {
  const setPassword = useAuthStore(s => s.setPassword);
  const isAdmin = useAuthStore(s => s.isAdmin);
  const [form, setForm] = useState({ password: '', confirm: '', role: agent.role || 'agent' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Şifreler eşleşmiyor');
    if (form.password.length < 6) return setError('En az 6 karakter');
    setError(''); setLoading(true);
    try {
      await setPassword({ agentId: agent.id, password: form.password, role: isAdmin ? form.role : undefined });
      setDone(true);
    } catch (e) {
      setError(e.response?.data?.error || 'Hata');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center py-4">
            <CheckCircle size={40} className="mx-auto text-emerald-500 mb-3" />
            <div className="text-slate-900 text-sm font-semibold">Şifre ayarlandı</div>
            <div className="text-xs text-slate-500 mt-1">{agent.name} artık giriş yapabilir</div>
            <button onClick={onClose} className="mt-5 px-5 py-2.5 bg-slate-900 rounded-lg text-white text-sm font-medium hover:bg-slate-800">Kapat</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Key size={15} className="text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">Şifre Ayarla</h3>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-5">{agent.name} · Dahili {agent.extension}</p>
            <form onSubmit={handle} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Yeni Şifre</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  autoFocus
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Şifre Tekrar</label>
                <input
                  type="password"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                />
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Rol</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                  >
                    <option value="agent">Çalışan</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )}
              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200">İptal</button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-40 hover:bg-slate-800">
                  {loading ? '...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
