import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Phone, Users, UserCheck, BarChart2, LogOut, Calendar, Zap, X, Mic } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const STATUS_DOT = {
  available: 'bg-emerald-500',
  busy: 'bg-red-500',
  break: 'bg-violet-500',
  offline: 'bg-slate-300',
};

export default function Sidebar({ onClose }) {
  const agent = useAuthStore(s => s.agent);
  const isAdmin = useAuthStore(s => s.isAdmin);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();

  const links = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/calls', icon: Phone, label: 'Çağrılar' },
    { to: '/customers', icon: Users, label: 'Müşteriler' },
    { to: '/appointments', icon: Calendar, label: 'Randevular' },
    ...(isAdmin ? [
      { to: '/campaigns', icon: Zap, label: 'Kampanyalar' },
      { to: '/agents',    icon: UserCheck, label: 'Çalışanlar' },
      { to: '/recordings', icon: Mic,       label: 'Ses Kayıtları' },
    ] : []),
    { to: '/reports', icon: BarChart2, label: 'Raporlar' },
  ];

  return (
    <aside className="w-56 h-full bg-white border-r border-slate-200 flex flex-col">
      <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-200 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold text-slate-900 leading-none tracking-tight">Parlaq</div>
          <div className="text-sm text-slate-400 mt-0.5">Call Center</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icon size={16} strokeWidth={1.75} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {agent && (
        <div className="px-3 pb-4 border-t border-slate-200 pt-3 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg mb-1">
            <div className="relative flex-shrink-0">
              <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white">
                {agent.name?.charAt(0) || '?'}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white ${STATUS_DOT[agent.status] || STATUS_DOT.offline}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">{agent.name}</div>
              <div className="text-xs text-slate-400">Dahili {agent.extension}</div>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={13} />
            <span>Çıkış Yap</span>
          </button>
        </div>
      )}
    </aside>
  );
}
