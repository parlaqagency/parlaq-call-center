import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import axios from 'axios';

export default function SetupAdmin() {
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handle = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Şifreler eşleşmiyor');
    if (form.password.length < 6) return setError('Şifre en az 6 karakter olmalı');
    setError('');
    setLoading(true);
    try {
      await axios.post('/api/auth/setup-admin', {
        email: form.email,
        password: form.password,
      });
      navigate('/login');
    } catch (e) {
      setError(e.response?.data?.error || 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/parlaq-logo.png" alt="Parlaq" className="w-24 h-24 object-contain mb-4" />
          <h1 className="text-xl font-bold text-slate-900">İlk Kurulum</h1>
          <p className="text-sm text-slate-500 mt-1">Admin hesabı oluştur</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">E-posta</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="admin@parlaq.com"
                required
                autoFocus
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 transition-colors placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Şifre</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="En az 6 karakter"
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 transition-colors placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Şifre Tekrar</label>
              <input
                type="password"
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="••••••••"
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 transition-colors placeholder:text-slate-400"
              />
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate-900 rounded-lg text-white text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Oluşturuluyor...' : 'Admin Hesabı Oluştur'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Bu sayfa yalnızca ilk kurulumda kullanılabilir
        </p>
      </motion.div>
    </div>
  );
}
