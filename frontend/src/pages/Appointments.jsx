import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarPlus, Check, X, Trash2, Calendar, Clock, User, Phone } from 'lucide-react';
import { useAppointmentStore } from '../store/appointmentStore';

const STATUS_STYLE = {
  pending:   { label: 'Bekliyor',     cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed: { label: 'Tamamlandı',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'İptal',        cls: 'bg-red-50 text-red-600 border-red-200' },
};

const DATE_TABS = [
  { key: 'upcoming', label: 'Yaklaşan' },
  { key: 'today',    label: 'Bugün' },
  { key: 'week',     label: 'Bu Hafta' },
  { key: '',         label: 'Tümü' },
];

function formatDateTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function isOverdue(ts, status) {
  return status === 'pending' && new Date(ts) < new Date();
}

export default function Appointments() {
  const { appointments, loading, fetchAppointments, updateStatus, deleteAppointment } = useAppointmentStore();
  const [dateFilter, setDateFilter] = useState('upcoming');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchAppointments({ date: dateFilter || undefined, status: statusFilter || undefined });
  }, [dateFilter, statusFilter]);

  const counts = {
    pending:   appointments.filter(a => a.status === 'pending').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    cancelled: appointments.filter(a => a.status === 'cancelled').length,
  };

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Bekliyor',   count: counts.pending,   color: 'bg-blue-50 text-blue-600 border-blue-200' },
          { label: 'Tamamlandı', count: counts.completed, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
          { label: 'İptal',      count: counts.cancelled, color: 'bg-red-50 text-red-500 border-red-200' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="text-xs font-medium text-slate-500 mb-1">{s.label}</div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{s.count}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-slate-100 rounded-lg p-1 gap-0.5">
          {DATE_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setDateFilter(t.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                dateFilter === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex bg-slate-100 rounded-lg p-1 gap-0.5">
          {[['', 'Hepsi'], ['pending', 'Bekliyor'], ['completed', 'Tamamlandı'], ['cancelled', 'İptal']].map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === val ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 ml-auto">{appointments.length} randevu</span>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3">Müşteri</th>
              <th className="px-5 py-3">Tarih / Saat</th>
              <th className="px-5 py-3">Başlık</th>
              <th className="px-5 py-3">Çalışan</th>
              <th className="px-5 py-3">Durum</th>
              <th className="px-5 py-3">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <AnimatePresence>
              {appointments.map(a => {
                const st = STATUS_STYLE[a.status] || STATUS_STYLE.pending;
                const overdue = isOverdue(a.scheduled_at, a.status);
                return (
                  <motion.tr
                    key={a.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`hover:bg-slate-50 transition-colors ${overdue ? 'bg-red-50/40' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {(a.customer_name || a.customer_phone || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {a.customer_name || '—'}
                          </div>
                          <div className="text-xs font-mono text-slate-400">{a.customer_phone || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className={`text-sm font-medium tabular-nums ${overdue ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatDateTime(a.scheduled_at)}
                      </div>
                      {overdue && <div className="text-xs text-red-500 font-medium">Geçmiş randevu</div>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm text-slate-900 font-medium">{a.title}</div>
                      {a.notes && <div className="text-xs text-slate-400 truncate max-w-xs">{a.notes}</div>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm text-slate-600">{a.agent_name || '—'}</div>
                      <div className="text-xs text-slate-400">Dahili {a.agent_extension}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {a.status === 'pending' && (
                          <>
                            <button
                              onClick={() => updateStatus(a.id, 'completed')}
                              className="p-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                              title="Tamamlandı"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => updateStatus(a.id, 'cancelled')}
                              className="p-1.5 bg-red-50 border border-red-200 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                              title="İptal Et"
                            >
                              <X size={13} />
                            </button>
                          </>
                        )}
                        {a.status !== 'pending' && (
                          <button
                            onClick={() => updateStatus(a.id, 'pending')}
                            className="p-1.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors text-xs"
                            title="Bekleyene Al"
                          >
                            ↺
                          </button>
                        )}
                        <button
                          onClick={() => deleteAppointment(a.id)}
                          className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                          title="Sil"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
            {!loading && appointments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center">
                  <Calendar size={32} className="mx-auto text-slate-300 mb-3" />
                  <div className="text-sm text-slate-500 font-medium">Randevu bulunamadı</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
