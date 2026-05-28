import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSipStore } from '../store/sipStore';

function AdminModal({ onClose }) {
  const adminLogin = useAuthStore(s => s.adminLogin);
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('parlaq_remember_admin');
    if (saved) {
      try {
        const { email, password } = JSON.parse(saved);
        setForm({ email: email || '', password: password || '' });
        setRememberMe(true);
      } catch {}
    }
  }, []);

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('parlaq_remember_admin', JSON.stringify({ email: form.email, password: form.password }));
      } else {
        localStorage.removeItem('parlaq_remember_admin');
      }
      const a = await adminLogin(form);
      navigate(a.role === 'admin' ? '/dashboard' : '/agent');
    } catch (e) {
      setError(e.response?.data?.error || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -8 }}
        className="w-full max-w-xs bg-white border border-slate-200 rounded-2xl shadow-xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-900">Admin Girişi</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handle} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">E-posta</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="admin@parlaq.com"
              required
              autoFocus
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 transition-colors placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Şifre</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                required
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-slate-900 text-sm focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 transition-colors placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-slate-700 cursor-pointer"
            />
            <span className="text-xs text-slate-500">Beni Hatırla</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-slate-900 rounded-lg text-white text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50 mt-1"
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default function Login() {
  const [form, setForm] = useState({ extension: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuthStore(s => s.login);
  const initSip = useSipStore(s => s.init);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('parlaq_remember_agent');
    if (saved) {
      try {
        const { extension, password } = JSON.parse(saved);
        setForm({ extension: extension || '', password: password || '' });
        setRememberMe(true);
      } catch {}
    }
  }, []);

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('parlaq_remember_agent', JSON.stringify({ extension: form.extension, password: form.password }));
      } else {
        localStorage.removeItem('parlaq_remember_agent');
      }
      const a = await login(form);
      if (a.sip_password) initSip(a);
      navigate(a.role === 'admin' ? '/dashboard' : '/agent');
    } catch (e) {
      setError(e.response?.data?.error || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative">
      <button
        onClick={() => setShowAdmin(true)}
        className="absolute top-5 right-5 text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white border border-transparent hover:border-slate-200"
      >
        <Shield size={12} />
        <span>Admin Girişi</span>
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-2">
          <img src="/parlaq-logo.png" alt="Parlaq" className="w-44 h-44 object-contain" />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-5">Çalışan Girişi</h2>
          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Dahili Numara</label>
              <input
                type="text"
                value={form.extension}
                onChange={e => setForm(f => ({ ...f, extension: e.target.value }))}
                placeholder="101"
                required
                autoFocus
                className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 transition-colors placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Şifre</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 pr-10 text-slate-900 text-sm focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 transition-colors placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-slate-700 cursor-pointer"
              />
              <span className="text-xs text-slate-500">Beni Hatırla</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-slate-900 rounded-lg text-white text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Şifrenizi bilmiyorsanız yöneticinizle iletişime geçin
        </p>
      </motion.div>

      <AnimatePresence>
        {showAdmin && <AdminModal onClose={() => setShowAdmin(false)} />}
      </AnimatePresence>
    </div>
  );
}
