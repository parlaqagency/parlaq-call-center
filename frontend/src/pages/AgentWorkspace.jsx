import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, Mic, MicOff, PhoneIncoming, PhoneOutgoing,
  LogOut, CheckCircle, PhoneMissed, ArrowRightLeft, Save, CalendarPlus, Calendar,
  Users, Clock, PauseCircle, X, TrendingUp, Zap,
} from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import { useCustomerStore } from '../store/customerStore';
import { useAppointmentStore } from '../store/appointmentStore';
import { useSipStore } from '../store/sipStore';
import CallInfoPanel from '../components/CallInfoPanel';
import ThemeToggle from '../components/ThemeToggle';

const BREAK_REASONS = ['Yemek Molası', 'Tuvalet', 'Toplantı', 'Teknik Sorun', 'Diğer'];

function SipStatusPill() {
  const { registered, registering } = useSipStore();
  const userRole = useAuthStore(s => s.agent?.role);
  if (userRole === 'admin') return null;
  const color = registered ? 'bg-emerald-500' : registering ? 'bg-amber-400 animate-pulse' : 'bg-slate-300';
  const label = registered ? 'SIP Kayıtlı' : registering ? 'Bağlanıyor...' : 'SIP Bağlı Değil';
  return (
    <span className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium flex-shrink-0 ${
      registered ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
      registering ? 'bg-amber-50 border-amber-200 text-amber-700' :
      'bg-slate-100 border-slate-200 text-slate-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`} />
      {label}
    </span>
  );
}

const STATUS_CFG = {
  available:  { label: 'Müsait',     dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  busy:       { label: 'Görüşmede',  dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  break:      { label: 'Molada',     dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  offline:    { label: 'Çevrimdışı', dot: 'bg-slate-300',   badge: 'bg-slate-100 text-slate-500 border-slate-200' },
};

// ── Real-time socket (agent-scope) ───────────────────────────────
function useAgentSocket({ onInbound, onHangup, onStats, onQueueUpdated }) {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001');
    socket.on('inbound_call', onInbound);
    socket.on('call_hangup', onHangup);
    socket.on('call_answered', onStats);
    socket.on('santral_event', (d) => { if (d.scenario === 'Hangup') onHangup(d); });
    socket.on('queue_updated', (d) => onQueueUpdated?.(d));
    return () => { socket.disconnect(); initialized.current = false; };
  }, []);
}

// ── Call Timer ───────────────────────────────────────────────────
function CallTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = startedAt ? new Date(startedAt).getTime() : Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  return <span className="font-mono text-4xl font-bold text-emerald-700 tabular-nums">{m}:{s}</span>;
}

// ── Active Call Panel (SIP tabanlı) ─────────────────────────────
function ActiveCallPanel({ prefillPhone, onPhoneUsed, onCallStart, onCallEnd }) {
  const { callStatus, callPhone, muted, session, registered, makeCall, hangup, toggleMute } = useSipStore();
  const agent = useAuthStore(s => s.agent);

  const [phone, setPhone]           = useState('');
  const [calling, setCalling]       = useState(false);
  const [note, setNote]             = useState('');
  const [noteSaved, setNoteSaved]   = useState(false);
  const [error, setError]           = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferExt, setTransferExt]   = useState('');
  const [callLogId, setCallLogId]   = useState(null);

  const isActive = callStatus !== null;

  useEffect(() => {
    if (prefillPhone) { setPhone(prefillPhone); onPhoneUsed?.(); }
  }, [prefillPhone]);

  // Çağrı bitince temizle + refresh
  useEffect(() => {
    if (!isActive && callLogId) {
      onCallEnd?.();
      setNote(''); setNoteSaved(false); setShowTransfer(false); setTransferExt(''); setCallLogId(null);
    }
  }, [isActive]);

  const handleCall = async () => {
    if (!phone.trim()) return;
    setError(''); setCalling(true);
    try {
      const { data: log } = await axios.post('/api/calls/log', { customerPhone: phone.trim(), direction: 'outbound' });
      setCallLogId(log?.id || null);
      makeCall(phone.trim(), log?.id);
      onCallStart?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Çağrı başlatılamadı');
    } finally {
      setCalling(false);
    }
  };

  const handleHangup = async () => {
    if (note.trim() && callLogId) {
      try { await axios.patch(`/api/reports/call/${callLogId}/notes`, { notes: note }); } catch {}
    }
    hangup();
  };

  const handleSaveNote = async () => {
    if (!note.trim() || !callLogId) return;
    try {
      await axios.patch(`/api/reports/call/${callLogId}/notes`, { notes: note });
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch {}
  };

  const handleTransfer = () => {
    if (!transferExt || !session) return;
    try {
      session.refer(`sip:${transferExt}@${import.meta.env.VITE_SIP_DOMAIN || 'sip9.netsantral.com'}`);
      setShowTransfer(false); setTransferExt('');
    } catch {}
  };

  if (isActive) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-emerald-200 rounded-2xl p-8 w-full max-w-sm shadow-sm text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">
              {callStatus === 'calling' ? 'Arıyor...' : 'Aktif Çağrı'}
            </span>
          </div>
          <div className="text-lg font-bold text-slate-900 mb-4 font-mono">{callPhone}</div>
          <CallTimer startedAt={null} />

          <div className="flex gap-2 mt-8">
            <button
              onClick={toggleMute}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border font-medium text-sm transition-colors ${
                muted ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {muted ? <MicOff size={15} /> : <Mic size={15} />}
              {muted ? 'Sessizden Çık' : 'Sessize Al'}
            </button>
            <button
              onClick={() => setShowTransfer(!showTransfer)}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ArrowRightLeft size={15} />
            </button>
            <button
              onClick={handleHangup}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors"
            >
              <PhoneOff size={15} />
              Kapat
            </button>
          </div>

          <AnimatePresence>
            {showTransfer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-2 mt-3 overflow-hidden"
              >
                <input
                  value={transferExt}
                  onChange={e => setTransferExt(e.target.value)}
                  placeholder="Dahili numara"
                  className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400 placeholder:text-slate-400"
                />
                <button
                  onClick={handleTransfer}
                  disabled={!transferExt}
                  className="px-4 py-2 bg-slate-900 rounded-lg text-sm text-white font-medium disabled:opacity-40 hover:bg-slate-800"
                >
                  Transfer
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-500">Görüşme Notu</label>
            <button
              onClick={handleSaveNote}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors ${noteSaved ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
            >
              <Save size={11} />
              {noteSaved ? 'Kaydedildi' : 'Kaydet'}
            </button>
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Bu görüşmeye not ekle..."
            rows={3}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 resize-none focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 placeholder:text-slate-400"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
      <div className="text-center mb-2">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <Phone size={28} className="text-emerald-400" />
        </div>
        <div className="text-sm font-medium text-slate-500">Arama yapmak için numara girin</div>
        <div className="text-xs text-slate-400 mt-1">
          {registered
            ? <span className="text-emerald-600 font-medium">● SIP Kayıtlı — Dahili {agent?.extension}</span>
            : <span className="text-slate-400">SIP bağlanıyor...</span>
          }
        </div>
      </div>

      <div className="flex gap-2 w-full max-w-sm">
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCall()}
          placeholder="0532 xxx xx xx"
          className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 placeholder:text-slate-400"
        />
        <button
          onClick={handleCall}
          disabled={calling || !phone || !registered}
          className="px-5 py-3 bg-emerald-600 rounded-xl text-white font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-40 flex items-center gap-2"
        >
          <Phone size={15} />
          {calling ? 'Arıyor...' : 'Ara'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Personal Lead Queue ───────────────────────────────────────────
const DISP_CFG = {
  answered:       { label: 'Cevaplandı',   cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  not_interested: { label: 'İlgilenmiyor', cls: 'text-slate-500 bg-slate-50 border-slate-200' },
  missed:         { label: 'Cevapsız',     cls: 'text-red-500 bg-red-50 border-red-200' },
  busy:           { label: 'Meşgul',       cls: 'text-amber-600 bg-amber-50 border-amber-200' },
  wrong_number:   { label: 'Yanlış No',    cls: 'text-purple-600 bg-purple-50 border-purple-200' },
  appointment:    { label: 'Randevu',      cls: 'text-blue-600 bg-blue-50 border-blue-200' },
  callback:       { label: 'Geri Arama',   cls: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
};

function maskPhone(p = '') {
  const c = p.replace(/\D/g, '');
  return c.length >= 7 ? c.slice(0, 3) + ' *** ** ' + c.slice(-2) : p;
}

function PersonalLeadQueue({ onCallLead, activeLeadId, refreshKey }) {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({ total: '0', completed: '0' });

  useEffect(() => {
    axios.get('/api/campaigns/my-queue').then(({ data }) => {
      setLeads(data.leads || []);
      setStats(data.stats || { total: '0', completed: '0' });
    }).catch(() => {});
  }, [refreshKey]);

  const total = parseInt(stats.total) || 0;
  const completed = parseInt(stats.completed) || 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="w-72 bg-white border-r border-slate-200 flex flex-col h-full flex-shrink-0">
      <div className="px-4 py-3.5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Aranacaklar
          </div>
          <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full tabular-nums">
            {completed}/{total}
          </span>
        </div>

        {total > 0 && (
          <div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">{pct}% tamamlandı</p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
              <Users size={14} className="text-slate-300" />
            </div>
            <p className="text-xs text-slate-300 font-medium">Atanmış lead yok</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {leads.map((lead, i) => {
            const isActive = lead.id === activeLeadId;
            const isDone = lead.status !== 'pending' && lead.status !== 'calling';
            const d = DISP_CFG[lead.disposition];
            return (
              <motion.div
                key={lead.id}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: isDone ? 0.5 : 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className={`flex items-center gap-2.5 px-4 py-2.5 transition-colors ${
                  isActive ? 'bg-emerald-50 border-l-2 border-l-emerald-400' : 'hover:bg-slate-50'
                }`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {(lead.name || lead.phone || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-800 truncate">{lead.name || '—'}</div>
                  <div className="text-xs font-mono text-slate-400">{maskPhone(lead.phone)}</div>
                </div>
                {d ? (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${d.cls}`}>
                    {d.label}
                  </span>
                ) : (
                  <button
                    onClick={() => !isDone && onCallLead(lead)}
                    disabled={isDone || isActive}
                    className="w-7 h-7 flex items-center justify-center bg-emerald-600 rounded-lg text-white flex-shrink-0 hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Phone size={12} />
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── My Call History ───────────────────────────────────────────────
function MyCallHistory({ refreshKey }) {
  const myHistory = useCallStore(s => s.myHistory);
  const fetchMyHistory = useCallStore(s => s.fetchMyHistory);

  useEffect(() => { fetchMyHistory(); }, [refreshKey]);

  function formatDur(s) {
    if (!s) return '—';
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function formatTime(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bugünkü Aramalarım</div>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{myHistory.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {myHistory.length === 0 && (
          <div className="text-center text-slate-400 text-xs py-10">Bugün henüz arama yok</div>
        )}
        {myHistory.map(c => (
          <div key={c.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2 mb-0.5">
              {c.direction === 'inbound'
                ? <PhoneIncoming size={11} className="text-blue-500 flex-shrink-0" />
                : <PhoneOutgoing size={11} className="text-emerald-500 flex-shrink-0" />}
              <span className="text-xs font-mono font-medium text-slate-900">{c.customer_phone}</span>
              <span className="ml-auto text-xs text-slate-400 tabular-nums">{formatTime(c.started_at)}</span>
            </div>
            <div className="flex items-center gap-2 pl-3.5">
              <span className={`text-xs font-medium ${
                c.status === 'answered' ? 'text-emerald-600' :
                c.status === 'missed' ? 'text-red-500' : 'text-slate-400'
              }`}>
                {c.status === 'answered' ? 'Cevaplandı' : c.status === 'missed' ? 'Cevapsız' : c.status}
              </span>
              {c.duration > 0 && (
                <span className="text-xs text-slate-400 font-mono tabular-nums ml-auto">{formatDur(c.duration)}</span>
              )}
            </div>
            {c.notes && (
              <div className="text-xs text-slate-400 italic mt-1 pl-3.5 truncate">{c.notes}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Appointment Modal ─────────────────────────────────────────────
const APPT_TITLES = ['Geri Arama', 'Demo', 'Teknik Destek', 'Sözleşme', 'Takip', 'Diğer'];

function AppointmentDetailModal({ appointment, onClose }) {
  const { updateAppointment, updateStatus, deleteAppointment } = useAppointmentStore();
  const toLocal = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [form, setForm] = useState({
    title: appointment.title || '',
    customer_name: appointment.customer_name || '',
    customer_phone: appointment.customer_phone || '',
    notes: appointment.notes || '',
    scheduled_at: toLocal(appointment.scheduled_at),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAppointment(appointment.id, {
        ...form,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
      });
      setSaved(true);
      setTimeout(() => { setSaved(false); }, 1800);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteAppointment(appointment.id);
    onClose();
  };

  const handleComplete = async () => {
    await updateStatus(appointment.id, 'completed');
    onClose();
  };

  const statusLabel = { pending: 'Bekliyor', completed: 'Tamamlandı', cancelled: 'İptal' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Calendar size={14} className="text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Randevu Detayı</h3>
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${
                appointment.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                appointment.status === 'cancelled' ? 'bg-red-50 text-red-500' :
                'bg-amber-50 text-amber-600'
              }`}>{statusLabel[appointment.status] || appointment.status}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Randevu Türü</label>
            <select
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400"
            >
              {APPT_TITLES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Müşteri Adı</label>
              <input
                value={form.customer_name}
                onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400"
                placeholder="Ad Soyad"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Telefon</label>
              <input
                value={form.customer_phone}
                onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400"
                placeholder="05xx xxx xx xx"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tarih & Saat</label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Not</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 resize-none"
              placeholder="Notlar..."
            />
          </div>
        </div>

        <div className="px-5 pb-5 flex items-center gap-2">
          {appointment.status === 'pending' && (
            <button
              onClick={handleComplete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors"
            >
              <CheckCircle size={13} />
              Tamamlandı
            </button>
          )}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
            >
              <X size={13} />
              Sil
            </button>
          ) : (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition-colors"
            >
              Emin misin? Sil
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Save size={13} />
            {saved ? 'Kaydedildi ✓' : saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AppointmentModal({ prefillPhone, prefillName, onClose }) {
  const createAppointment = useAppointmentStore(s => s.createAppointment);
  const fetchMyAppointments = useAppointmentStore(s => s.fetchAppointments);

  const now = new Date();
  now.setMinutes(now.getMinutes() + 30 - (now.getMinutes() % 30));
  const defaultDt = now.toISOString().slice(0, 16);

  const [form, setForm] = useState({
    customer_phone: prefillPhone || '',
    customer_name: prefillName || '',
    title: 'Geri Arama',
    notes: '',
    scheduled_at: defaultDt,
  });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handle = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await createAppointment({
        ...form,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
      });
      setDone(true);
      fetchMyAppointments({ date: 'today' });
    } catch (e) {
      setError(e.response?.data?.error || 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center py-6">
            <CheckCircle size={40} className="mx-auto text-emerald-500 mb-3" />
            <div className="text-slate-900 font-semibold">Randevu oluşturuldu</div>
            <div className="text-xs text-slate-500 mt-1">{form.customer_name || form.customer_phone} · {form.title}</div>
            <button onClick={onClose} className="mt-5 px-5 py-2.5 bg-slate-900 rounded-lg text-white text-sm font-medium hover:bg-slate-800">
              Kapat
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-5">
              <CalendarPlus size={16} className="text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">Randevu Oluştur</h3>
            </div>
            <form onSubmit={handle} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Müşteri Adı</label>
                  <input
                    value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    placeholder="Ad Soyad"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">Telefon</label>
                  <input
                    value={form.customer_phone}
                    onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                    placeholder="0532 xxx xx xx"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Randevu Türü</label>
                <div className="flex flex-wrap gap-1.5">
                  {APPT_TITLES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, title: t }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        form.title === t
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400 hover:text-emerald-600'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Tarih & Saat</label>
                <input
                  type="datetime-local"
                  required
                  value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Not <span className="text-slate-400 font-normal">(isteğe bağlı)</span></label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Ek bilgi..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 resize-none focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 placeholder:text-slate-400"
                />
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200">
                  İptal
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40">
                  {loading ? 'Kaydediliyor...' : 'Randevu Oluştur'}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ── Today's Appointments (right panel extension) ──────────────────
function TodayAppointments() {
  const { appointments, fetchAppointments } = useAppointmentStore();
  const todayAppts = appointments.filter(a => a.status === 'pending');
  const [selectedAppt, setSelectedAppt] = useState(null);

  useEffect(() => {
    fetchAppointments({ date: 'today' });
  }, []);

  if (todayAppts.length === 0) return null;

  return (
    <div className="border-t border-slate-100 mt-auto">
      <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        <Calendar size={11} />
        Bugünkü Randevular
      </div>
      <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
        {todayAppts.map(a => (
          <div
            key={a.id}
            onClick={() => setSelectedAppt(a)}
            className="px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-900 truncate">{a.title}</div>
              <div className="text-xs text-slate-400">{a.customer_name || a.customer_phone || '—'}</div>
              <div className="text-xs text-emerald-600 font-medium tabular-nums">
                {new Date(a.scheduled_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {selectedAppt && (
          <AppointmentDetailModal
            appointment={selectedAppt}
            onClose={() => setSelectedAppt(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Callback Queue ────────────────────────────────────────────────
function CallbackQueue({ onCall }) {
  const callbacks = useCallStore(s => s.callbacks);
  const fetchCallbacks = useCallStore(s => s.fetchCallbacks);

  useEffect(() => {
    fetchCallbacks();
    const id = setInterval(fetchCallbacks, 60000);
    return () => clearInterval(id);
  }, []);

  if (callbacks.length === 0) return null;

  function getUrgency(callbackAt) {
    const diff = new Date(callbackAt).getTime() - Date.now();
    if (diff < 0) return 'overdue';
    if (diff < 15 * 60 * 1000) return 'soon';
    return 'future';
  }

  function fmtCallbackTime(callbackAt) {
    return new Date(callbackAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  const URGENCY_STYLE = {
    overdue: { row: 'bg-red-50', time: 'text-red-600 font-semibold', icon: 'text-red-500' },
    soon:    { row: 'bg-amber-50', time: 'text-amber-600 font-semibold', icon: 'text-amber-500' },
    future:  { row: '', time: 'text-slate-400', icon: 'text-slate-300' },
  };

  return (
    <div className="border-t border-slate-100">
      <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        <Bell size={11} />
        Geri Aramalar
        <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full font-normal">{callbacks.length}</span>
      </div>
      <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
        {callbacks.map(cb => {
          const urgency = getUrgency(cb.callback_at);
          const sty = URGENCY_STYLE[urgency];
          return (
            <div key={cb.id} className={`px-4 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition-colors ${sty.row}`}>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono font-medium text-slate-900 truncate">{cb.customer_phone}</div>
                {(cb.customer_name || cb.customer_surname) && (
                  <div className="text-xs text-slate-400 truncate">{[cb.customer_name, cb.customer_surname].filter(Boolean).join(' ')}</div>
                )}
                <div className={`text-xs tabular-nums mt-0.5 ${sty.time}`}>
                  {urgency === 'overdue' ? 'GECİKTİ · ' : ''}{fmtCallbackTime(cb.callback_at)}
                </div>
              </div>
              <button
                onClick={() => onCall(cb.customer_phone)}
                className="w-7 h-7 flex items-center justify-center bg-emerald-600 rounded-lg text-white hover:bg-emerald-700 transition-colors flex-shrink-0"
                title="Ara"
              >
                <Phone size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Agent Dashboard (idle center) ────────────────────────────────
function AgentDashboard({ prefillPhone, onPhoneUsed, onCallStart, agentStatus, incomingSession }) {
  const { registered, makeCall } = useSipStore();
  const myHourly     = useCallStore(s => s.myHourly);
  const fetchMyHourly = useCallStore(s => s.fetchMyHourly);
  const agent        = useAuthStore(s => s.agent);
  const myStats      = useCallStore(s => s.myStats);
  const myHistory    = useCallStore(s => s.myHistory);
  const appointments = useAppointmentStore(s => s.appointments);

  const [phone, setPhone]                   = useState('');
  const [calling, setCalling]               = useState(false);
  const [error, setError]                   = useState('');
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [selectedAppt, setSelectedAppt]     = useState(null);

  useEffect(() => {
    if (prefillPhone) { setPhone(prefillPhone); onPhoneUsed?.(); }
  }, [prefillPhone]);

  useEffect(() => {
    axios.get('/api/campaigns').then(({ data }) => {
      const list = Array.isArray(data) ? data : (data.campaigns || []);
      setActiveCampaign(list.find(c => c.status === 'running') || null);
    }).catch(() => {});
    fetchMyHourly();
  }, []);

  const handleCall = async () => {
    if (!phone.trim() || !registered) return;
    setError(''); setCalling(true);
    try {
      const { data: log } = await axios.post('/api/calls/log', { customerPhone: phone.trim(), direction: 'outbound' });
      makeCall(phone.trim(), log?.id);
      onCallStart?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Çağrı başlatılamadı');
      setCalling(false);
    }
  };

  const todayStr = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });

  function fmtTalk(secs) {
    if (!secs) return '—';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}sa ${m}dk` : m > 0 ? `${m}dk` : '<1dk';
  }

  const DISP_COLOR = {
    interested:     'bg-emerald-50 text-emerald-700 border-emerald-100',
    not_interested: 'bg-red-50 text-red-600 border-red-100',
    appointment:    'bg-blue-50 text-blue-700 border-blue-100',
    callback:       'bg-violet-50 text-violet-700 border-violet-100',
    no_audio:       'bg-slate-100 text-slate-500 border-slate-200',
    busy:           'bg-amber-50 text-amber-600 border-amber-100',
    no_answer:      'bg-orange-50 text-orange-600 border-orange-100',
    wrong_number:   'bg-pink-50 text-pink-600 border-pink-100',
    answered:       'bg-emerald-50 text-emerald-700 border-emerald-100',
    missed:         'bg-red-50 text-red-600 border-red-100',
  };

  const DISP_LABEL = {
    interested: 'İlgileniyor', not_interested: 'İlgilenmiyor',
    appointment: 'Randevu', callback: 'Geri Ara', no_audio: 'Ses Yok',
    busy: 'Meşgul', no_answer: 'Cevap Yok', wrong_number: 'Yanlış No',
    answered: 'Cevaplandı', missed: 'Cevapsız', ringing: 'Çalıyor',
  };

  const recentCalls  = (myHistory || []).slice(0, 4);
  const pendingAppts = (appointments || []).filter(a => a.status === 'pending').slice(0, 4);

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="flex-1 overflow-y-auto px-6 py-5 space-y-5 bg-[#F8FAFC]"
    >
      {/* Welcome + Campaign */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut', delay: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Merhaba, {agent?.name?.split(' ')[0]}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 capitalize">{todayStr}</p>
        </div>
        {activeCampaign && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-full flex-shrink-0">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />
            <span className="text-xs font-medium text-blue-700 max-w-[120px] truncate">{activeCampaign.name}</span>
          </div>
        )}
      </motion.div>

      {/* ACD State — manual dialer hidden, waiting animation shown */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut', delay: 0.06 }}
        className="flex flex-col items-center text-center gap-3 py-1"
      >
        <AnimatePresence mode="wait">
          {incomingSession ? (
            // Gelen çağrı var — cevap beklenyor
            <motion.div
              key="incoming"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                  <Phone size={24} className="text-emerald-600" />
                </div>
                <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-30" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Gelen Çağrı</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {incomingSession.remote_identity?.uri?.user || 'Bilinmeyen numara'}
                </p>
              </div>
              <p className="text-xs text-emerald-600 font-medium">Telefonu cevaplamak için bekleyin...</p>
            </motion.div>
          ) : phone ? (
            // Müşteri listesinden gelen numara — hızlı arama
            <motion.div
              key="prefill"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl w-full max-w-xs"
            >
              <Phone size={14} className="text-slate-400 flex-shrink-0" />
              <span className="flex-1 text-sm font-mono font-medium text-slate-800 text-left">{phone}</span>
              <button
                onClick={handleCall}
                disabled={calling || !registered}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1"
              >
                <Phone size={11} /> {calling ? '...' : 'Ara'}
              </button>
              <button onClick={() => setPhone('')} className="text-slate-300 hover:text-slate-500">
                <X size={14} />
              </button>
            </motion.div>
          ) : agentStatus === 'available' ? (
            // Boşta — scanning animation
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="relative w-56 h-0.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 w-20 rounded-full"
                  style={{ background: 'linear-gradient(90deg, transparent, #34d399, transparent)' }}
                  animate={{ x: ['-80px', '224px'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.4 }}
                />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-[260px]">
                Kendinizi rahat ve güvenli hissettiğiniz<br />zaman aramaya başlayabilirsiniz.
              </p>
              {!registered && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />
                  SIP bağlanıyor...
                </p>
              )}
            </motion.div>
          ) : (
            // Çağrıya kapalı
            <motion.div
              key="paused"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="relative">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'rgba(251,191,36,0.2)' }}
                  animate={{ scale: [1, 1.7, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="relative w-12 h-12 rounded-full bg-amber-50 border border-amber-200/60 flex items-center justify-center">
                  <PauseCircle size={22} className="text-amber-500" />
                </div>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border" style={{ background: 'rgba(255,251,235,0.7)', borderColor: 'rgba(251,191,36,0.3)' }}>
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-amber-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="text-xs font-semibold text-amber-700 tracking-wide">Çağrıya Kapalı</span>
              </div>
              <p className="text-xs text-slate-400 max-w-[220px] leading-relaxed text-center">
                Hazır olduğunuzda "Çağrıya Açık" butonuna basabilirsiniz.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } } }}
        className="grid grid-cols-3 gap-3"
      >
        {[
          {
            label: 'Toplam Çağrı',
            value: myStats?.total ?? 0,
            sub: `${myStats?.answered ?? 0} cevaplandı`,
            icon: Phone,
            iconStyle: { background: 'rgba(16,185,129,0.08)' },
            iconColor: 'text-emerald-600',
          },
          {
            label: 'Konuşma Süresi',
            value: fmtTalk(myStats?.talk_seconds),
            sub: 'bugün toplam',
            icon: Clock,
            iconStyle: { background: 'rgba(99,102,241,0.08)' },
            iconColor: 'text-indigo-600',
          },
          {
            label: 'Bekleyen Randevu',
            value: pendingAppts.length,
            sub: 'bugün',
            icon: Calendar,
            iconStyle: { background: 'rgba(139,92,246,0.08)' },
            iconColor: 'text-violet-600',
          },
        ].map((kpi) => (
          <motion.div
            key={kpi.label}
            variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } } }}
            whileHover={{ scale: 1.01 }}
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 8px 24px rgba(149,157,165,0.05)' }}
            className="bg-white border border-slate-200/60 rounded-2xl p-4 cursor-default transition-shadow duration-300 hover:shadow-[0_4px_20px_rgba(149,157,165,0.12),0_1px_4px_rgba(0,0,0,0.04)]"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={kpi.iconStyle}>
              <kpi.icon size={16} className={kpi.iconColor} />
            </div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide leading-tight mb-1.5">{kpi.label}</p>
            <div className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight leading-none">{kpi.value}</div>
            <p className="text-xs text-slate-400 mt-2">{kpi.sub}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Başarı Çizgisi — full-width sparkline */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.18 }}
        whileHover={{ scale: 1.005 }}
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 8px 24px rgba(149,157,165,0.05)' }}
        className="bg-white border border-slate-200/60 rounded-2xl px-5 py-4 transition-all duration-300"
      >
        <SparklineChart data={myHourly} />
      </motion.div>

      {/* Recent Activity + Appointments */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut', delay: 0.25 }}
        className="grid grid-cols-2 gap-4"
      >
        <motion.div
          whileHover={{ scale: 1.005 }}
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 8px 24px rgba(149,157,165,0.05)' }}
          className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-[0_4px_20px_rgba(149,157,165,0.1)]"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Son Aramalar</span>
            <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full tabular-nums">{recentCalls.length}</span>
          </div>
          {recentCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <Phone size={14} className="text-slate-300" />
              </div>
              <p className="text-xs text-slate-300 font-medium">Henüz arama yok</p>
              <div className="flex gap-1.5 mt-0.5">
                {[40, 28, 36].map((w, i) => (
                  <div key={i} className="h-0.5 rounded-full bg-slate-100" style={{ width: w }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentCalls.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="px-4 py-2.5 flex items-center gap-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-medium text-slate-800 truncate">{c.customer_phone}</div>
                    <div className="text-xs text-slate-300 tabular-nums">
                      {new Date(c.created_at || c.started_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      {c.duration > 0 && ` · ${Math.floor(c.duration / 60)}:${String(c.duration % 60).padStart(2, '0')}`}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0 ${
                    DISP_COLOR[c.disposition] || DISP_COLOR[c.status] || 'bg-slate-50 text-slate-400 border-slate-100'
                  }`}>
                    {DISP_LABEL[c.disposition] || DISP_LABEL[c.status] || '—'}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.005 }}
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 8px 24px rgba(149,157,165,0.05)' }}
          className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden transition-shadow duration-300 hover:shadow-[0_4px_20px_rgba(149,157,165,0.1)]"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Randevular</span>
            <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full tabular-nums">{pendingAppts.length}</span>
          </div>
          {pendingAppts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <Calendar size={14} className="text-slate-300" />
              </div>
              <p className="text-xs text-slate-300 font-medium">Bekleyen randevu yok</p>
              <div className="flex gap-1.5 mt-0.5">
                {[36, 44, 28].map((w, i) => (
                  <div key={i} className="h-0.5 rounded-full bg-slate-100" style={{ width: w }} />
                ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {pendingAppts.map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedAppt(a)}
                  className="px-4 py-2.5 group hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-800 truncate">{a.title}</div>
                      <div className="text-xs text-slate-400 truncate">{a.customer_name || a.customer_phone || '—'}</div>
                      <div className="text-xs text-emerald-600 font-semibold tabular-nums mt-0.5">
                        {new Date(a.scheduled_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setPhone(a.customer_phone || ''); }}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-6 h-6 flex items-center justify-center bg-emerald-600 rounded-lg text-white transition-all mt-0.5"
                    >
                      <Phone size={11} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>

    <AnimatePresence>
      {selectedAppt && (
        <AppointmentDetailModal
          appointment={selectedAppt}
          onClose={() => setSelectedAppt(null)}
        />
      )}
    </AnimatePresence>
    </>
  );
}

// ── Sparkline Micro-Chart ─────────────────────────────────────────
function SparklineChart({ data = [] }) {
  const currentHour = new Date().getHours();
  const filled = Array.from({ length: currentHour + 1 }, (_, h) => ({
    hour: h,
    count: (data.find(d => d.hour === h)?.count) || 0,
  }));

  const W = 480;
  const H = 80;
  const pad = { x: 10, y: 10 };
  const max = Math.max(...filled.map(d => d.count), 1);

  if (filled.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center h-24 gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
          <TrendingUp size={15} className="text-slate-300" />
        </div>
        <p className="text-xs text-slate-300 font-medium">Henüz veri yok</p>
        <div className="flex gap-1.5">
          {[40, 24, 32].map((w, i) => (
            <div key={i} className="h-0.5 rounded-full bg-slate-100" style={{ width: w }} />
          ))}
        </div>
      </div>
    );
  }

  const pts = filled.map((d, i) => ({
    x: pad.x + (i / (filled.length - 1)) * (W - pad.x * 2),
    y: pad.y + (1 - d.count / max) * (H - pad.y * 2),
  }));

  // Smooth cubic bezier
  const smoothPath = pts.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    const prev = arr[i - 1];
    const cpx = ((prev.x + pt.x) / 2).toFixed(1);
    return `${acc} C ${cpx} ${prev.y.toFixed(1)}, ${cpx} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const last = pts[pts.length - 1];
  const fillPath = `${smoothPath} L ${last.x.toFixed(1)} ${H} L ${pts[0].x.toFixed(1)} ${H} Z`;

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Başarı Çizgisi</p>
        <span className="text-xs text-slate-300 tabular-nums">
          {new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
        </span>
      </div>
      <svg width="100%" height={H + 4} viewBox={`0 0 ${W} ${H + 4}`} preserveAspectRatio="none" overflow="visible">
        <defs>
          <linearGradient id="spFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.13" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="spStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#10b981" stopOpacity="1" />
            <stop offset="100%" stopColor="#059669" stopOpacity="1" />
          </linearGradient>
          <filter id="dotGlow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d={fillPath} fill="url(#spFill)" />
        <motion.path
          d={smoothPath}
          fill="none"
          stroke="url(#spStroke)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.9, ease: 'easeOut' }}
        />
        <motion.circle
          cx={last.x} cy={last.y} r="6"
          fill="#10b981" opacity="0.35"
          filter="url(#dotGlow)"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.35 }}
          transition={{ delay: 1.7, duration: 0.35 }}
        />
        <motion.circle
          cx={last.x} cy={last.y} r="3.5"
          fill="white" stroke="#10b981" strokeWidth="1.8"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.7, duration: 0.35 }}
        />
      </svg>
    </div>
  );
}

// ── Premium ACD Status Toggle ─────────────────────────────────────
function StatusToggle({ status, loading, onOpen, onClose }) {
  const isOpen = status === 'available';
  return (
    <div className="flex items-center bg-slate-100 rounded-[14px] p-0.5 gap-0 flex-shrink-0">
      <button
        onClick={onClose}
        disabled={loading || !isOpen}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[11px] text-xs font-semibold transition-all duration-200 ${
          !isOpen
            ? 'bg-slate-800 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${!isOpen ? 'bg-red-400' : 'bg-slate-300'}`} />
        <span className="hidden sm:inline">Çağrıya Kapalı</span>
        <span className="sm:hidden">Kapalı</span>
      </button>
      <button
        onClick={onOpen}
        disabled={loading || isOpen}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-[11px] text-xs font-semibold transition-all duration-200 ${
          isOpen
            ? 'bg-emerald-500 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOpen ? 'bg-white animate-pulse' : 'bg-slate-300'}`} />
        <span className="hidden sm:inline">Çağrıya Açık</span>
        <span className="sm:hidden">Açık</span>
      </button>
    </div>
  );
}

// ── Main Workspace ────────────────────────────────────────────────
export default function AgentWorkspace() {
  const navigate          = useNavigate();
  const agent             = useAuthStore(s => s.agent);
  const logout            = useAuthStore(s => s.logout);
  const updateAgentStatus = useAuthStore(s => s.updateAgentStatus);
  const myStats    = useCallStore(s => s.myStats);
  const fetchMyStats   = useCallStore(s => s.fetchMyStats);
  const fetchMyHistory = useCallStore(s => s.fetchMyHistory);
  const addInboundCall = useCallStore(s => s.addInboundCall);
  const removeCall     = useCallStore(s => s.removeCall);
  const callStatus     = useSipStore(s => s.callStatus);
  const makeCall       = useSipStore(s => s.makeCall);

  const incomingSession = useSipStore(s => s.incomingSession);

  const [status, setStatus]           = useState(agent?.status || 'offline');
  const [breakReason, setBreakReason] = useState(agent?.status === 'break' ? (agent?.break_reason || '') : '');
  const [showBreakPicker, setShowBreakPicker] = useState(false);
  const [showAppt, setShowAppt]       = useState(false);
  const [apptPhone, setApptPhone]     = useState('');
  const [dialPhone, setDialPhone]     = useState('');
  const [loading, setLoading]         = useState(false);
  const [historyKey, setHistoryKey]   = useState(0);
  const [activeLeadId, setActiveLeadId]       = useState(null);
  const [queueRefreshKey, setQueueRefreshKey] = useState(0);
  const activeCall = useCallStore(s => s.activeCall);

  const handleCallLead = async (lead) => {
    setActiveLeadId(lead.id);
    try {
      const { data } = await axios.post('/api/calls', { phone: lead.phone, campaign_contact_id: lead.id });
      makeCall(lead.phone, data.id);
    } catch {
      makeCall(lead.phone, null);
    }
  };

  // Socket — real-time events
  useAgentSocket({
    onInbound: (data) => addInboundCall(data),
    onHangup: (data) => {
      removeCall(data.unique_id);
      fetchMyStats();
      setHistoryKey(k => k + 1);
    },
    onStats: () => fetchMyStats(),
    onQueueUpdated: () => setQueueRefreshKey(k => k + 1),
  });

  useEffect(() => {
    fetchMyStats();
    fetchMyHistory();
    const id = setInterval(fetchMyStats, 30000);
    return () => clearInterval(id);
  }, []);

  // Sync status from authStore on mount / external change
  useEffect(() => {
    if (agent?.status) {
      setStatus(agent.status);
      setBreakReason(agent.status === 'break' ? (agent.break_reason || '') : '');
    }
  }, [agent?.status, agent?.break_reason]);

  const updateStatus = async (action, reason) => {
    setLoading(true);
    try {
      const { data } = await axios.post(`/api/agents/me/${action}`, reason ? { reason } : {});
      setStatus(data.status);
      setBreakReason(data.status === 'break' ? (data.break_reason || '') : '');
      updateAgentStatus(data.status, data.break_reason || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openAppt = (phone = '') => {
    setApptPhone(phone);
    setShowAppt(true);
  };

  const handleCallStart = () => {
    setStatus('busy');
  };

  const handleCallEnd = () => {
    setStatus('available');
    fetchMyStats();
    setHistoryKey(k => k + 1);
  };

  // Mobile tab state: 'dialer' | 'queue' | 'history'
  const [mobileTab, setMobileTab] = useState('dialer');

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* ── Top Bar ── */}
      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/80 flex items-center px-3 md:px-5 gap-2 md:gap-4 flex-shrink-0 transition-colors duration-200">
        <div className="hidden md:flex flex-col leading-none flex-shrink-0">
          <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Parlaq</span>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-[0.14em] uppercase">Agency Call Center</span>
        </div>

        {/* Agent info */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-slate-900 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            {agent?.name?.charAt(0) || '?'}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-900 dark:text-slate-200 leading-none">{agent?.name}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">Dahili {agent?.extension}</div>
          </div>
        </div>

        {/* Premium ACD Status Toggle */}
        <div className="relative flex-shrink-0">
          <StatusToggle
            status={status}
            loading={loading}
            onOpen={() => {
              if (status === 'break') updateStatus('unpause');
              else updateStatus('login');
            }}
            onClose={() => setShowBreakPicker(p => !p)}
          />
          <AnimatePresence>
            {showBreakPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowBreakPicker(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full left-0 mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 py-1 min-w-[170px]"
                >
                  <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Mola Sebebi</div>
                  {BREAK_REASONS.map(r => (
                    <button
                      key={r}
                      onClick={() => { setShowBreakPicker(false); updateStatus('pause', r); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      {r}
                    </button>
                  ))}
                  <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                    <button
                      onClick={() => { setShowBreakPicker(false); updateStatus('logoff'); }}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex items-center gap-2"
                    >
                      <LogOut size={12} /> Görevi Bitir
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Randevu butonu */}
        <button
          onClick={() => openAppt(activeCall?.customer_phone || '')}
          className="hidden sm:flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors flex-shrink-0"
        >
          <CalendarPlus size={13} />
          <span className="hidden md:inline">Randevu Al</span>
        </button>

        {/* SIP status */}
        <SipStatusPill />

        {/* Right: stats + logout */}
        <div className="ml-auto flex items-center gap-3 md:gap-4 flex-shrink-0">
          <div className="hidden lg:flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Phone size={12} className="text-slate-400" />
              <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{myStats?.total ?? 0}</span>
              <span className="text-slate-400 dark:text-slate-500">çağrı</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle size={12} className="text-emerald-500" />
              <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{myStats?.answered ?? 0}</span>
              <span className="text-slate-400 dark:text-slate-500">cevap</span>
            </span>
            {(myStats?.missed ?? 0) > 0 && (
              <span className="flex items-center gap-1.5">
                <PhoneMissed size={12} className="text-red-400" />
                <span className="font-bold text-red-600 dark:text-red-400 tabular-nums">{myStats.missed}</span>
                <span className="text-slate-400 dark:text-slate-500">cevapsız</span>
              </span>
            )}
          </div>

          <ThemeToggle />

          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">Çıkış</span>
          </button>
        </div>
      </header>

      {/* ── Desktop: 3-Column | Mobile: Single Column with Tab Bar ── */}

      {/* DESKTOP layout (md+) */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <PersonalLeadQueue
          refreshKey={queueRefreshKey}
          activeLeadId={activeLeadId}
          onCallLead={handleCallLead}
        />

        <div className="flex-1 flex flex-col overflow-hidden bg-[#F8FAFC]">
          <AnimatePresence mode="wait">
            {callStatus !== null ? (
              <motion.div
                key="panel"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="flex-1 overflow-hidden flex flex-col"
              >
                <CallInfoPanel
                  callLogId={useSipStore.getState().callLogId}
                  onHangup={handleCallEnd}
                />
              </motion.div>
            ) : (
              <AgentDashboard
                key="dashboard"
                prefillPhone={dialPhone}
                onPhoneUsed={() => setDialPhone('')}
                onCallStart={handleCallStart}
                agentStatus={status}
                incomingSession={incomingSession}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="w-72 bg-white border-l border-slate-200 flex flex-col h-full flex-shrink-0">
          <MyCallHistory refreshKey={historyKey} />
          <CallbackQueue onCall={setDialPhone} />
          <TodayAppointments />
        </div>
      </div>

      {/* MOBILE layout (<md) */}
      <div className="md:hidden flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Active call always takes over on mobile too */}
            {(callStatus !== null) ? (
              <motion.div
                key="active-call"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full overflow-hidden flex flex-col"
              >
                <CallInfoPanel
                  callLogId={useSipStore.getState().callLogId}
                  onHangup={handleCallEnd}
                />
              </motion.div>
            ) : mobileTab === 'dialer' ? (
              <motion.div
                key="mobile-dialer"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
                className="h-full overflow-y-auto"
              >
                <AgentDashboard
                  prefillPhone={dialPhone}
                  onPhoneUsed={() => setDialPhone('')}
                  onCallStart={handleCallStart}
                  agentStatus={status}
                  incomingSession={incomingSession}
                />
              </motion.div>
            ) : mobileTab === 'queue' ? (
              <motion.div
                key="mobile-queue"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
                className="h-full overflow-hidden flex flex-col bg-white"
              >
                <PersonalLeadQueue
                  refreshKey={queueRefreshKey}
                  activeLeadId={activeLeadId}
                  onCallLead={handleCallLead}
                />
              </motion.div>
            ) : (
              <motion.div
                key="mobile-history"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
                className="h-full overflow-hidden flex flex-col bg-white"
              >
                <MyCallHistory refreshKey={historyKey} />
                <CallbackQueue onCall={(phone) => { setDialPhone(phone); setMobileTab('dialer'); }} />
                <TodayAppointments />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile bottom tab bar */}
        {callStatus === null && (
          <nav className="flex-shrink-0 bg-white border-t border-slate-200 flex">
            {[
              { id: 'dialer', icon: Phone, label: 'Ara' },
              { id: 'queue', icon: Zap, label: 'Listelerim' },
              { id: 'history', icon: Clock, label: 'Geçmiş' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setMobileTab(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                  mobileTab === id
                    ? 'text-emerald-600'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon size={20} strokeWidth={mobileTab === id ? 2.5 : 1.75} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAppt && (
          <AppointmentModal
            prefillPhone={apptPhone}
            onClose={() => setShowAppt(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
