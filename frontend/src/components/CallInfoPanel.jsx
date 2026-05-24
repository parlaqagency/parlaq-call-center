import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, Mic, MicOff, ArrowRightLeft,
  CheckCircle, XCircle, Calendar, RotateCcw, VolumeX,
  PhoneOff as BusyIcon, HelpCircle, Clock, User, Building2,
  PhoneIncoming, PhoneOutgoing, Save, X,
} from 'lucide-react';
import axios from 'axios';
import { useSipStore } from '../store/sipStore';

// ── Disposition tanımları ────────────────────────────────────────
const DISPOSITIONS = [
  { key: 'interested',     label: 'İlgileniyor',        icon: CheckCircle, color: 'emerald' },
  { key: 'not_interested', label: 'İlgilenmiyor',       icon: XCircle,     color: 'red' },
  { key: 'appointment',    label: 'Randevu Alındı',     icon: Calendar,    color: 'blue' },
  { key: 'callback',       label: 'Tekrar Ara',         icon: RotateCcw,   color: 'violet' },
  { key: 'no_audio',       label: 'Ses Yok / Hat Bozuk', icon: VolumeX,   color: 'amber' },
  { key: 'busy',           label: 'Meşgul',             icon: BusyIcon,    color: 'orange' },
  { key: 'no_answer',      label: 'Cevap Yok',          icon: Clock,       color: 'slate' },
  { key: 'wrong_number',   label: 'Yanlış Numara',      icon: HelpCircle,  color: 'slate' },
];

const D_COLOR = {
  emerald: 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-emerald-200',
  red:     'bg-red-50 border-red-300 text-red-700 ring-red-200',
  blue:    'bg-blue-50 border-blue-300 text-blue-700 ring-blue-200',
  violet:  'bg-violet-50 border-violet-300 text-violet-700 ring-violet-200',
  amber:   'bg-amber-50 border-amber-300 text-amber-700 ring-amber-200',
  orange:  'bg-orange-50 border-orange-300 text-orange-700 ring-orange-200',
  slate:   'bg-slate-100 border-slate-300 text-slate-600 ring-slate-200',
};
const D_COLOR_IDLE = 'bg-white border-slate-200 text-slate-600 hover:border-slate-400';

// ── Timer ────────────────────────────────────────────────────────
function CallTimer({ active }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    setSecs(0);
    if (!active) return;
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">{m}:{s}</span>;
}

// ── Çağrı geçmişi satırı ────────────────────────────────────────
function HistoryRow({ call }) {
  const dt = call.started_at
    ? new Date(call.started_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';
  const dur = call.duration
    ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}`
    : '—';
  const disp = DISPOSITIONS.find(d => d.key === call.disposition);
  return (
    <div className="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
      {call.direction === 'inbound'
        ? <PhoneIncoming size={12} className="text-blue-500 flex-shrink-0" />
        : <PhoneOutgoing size={12} className="text-emerald-500 flex-shrink-0" />}
      <span className="text-xs text-slate-500 flex-shrink-0">{dt}</span>
      <span className="font-mono text-xs text-slate-600 flex-shrink-0 tabular-nums">{dur}</span>
      {disp && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ml-auto ${D_COLOR[disp.color]}`}>
          {disp.label}
        </span>
      )}
      {!disp && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full border ml-auto ${
          call.status === 'answered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
        }`}>
          {call.status === 'answered' ? 'Cevaplandı' : 'Cevapsız'}
        </span>
      )}
    </div>
  );
}

// ── Ana Panel ────────────────────────────────────────────────────
export default function CallInfoPanel({ callLogId, onHangup, compact = false }) {
  const { callPhone, callStatus, muted, session, toggleMute, hangup } = useSipStore();

  const [customer, setCustomer]     = useState(null);
  const [history, setHistory]       = useState([]);
  const [disposition, setDisp]      = useState('');
  const [note, setNote]             = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [transferExt, setTransferExt] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [saved, setSaved]           = useState(false);
  const [saving, setSaving]         = useState(false);

  const isActive = callStatus === 'active';
  const isCalling = callStatus === 'calling';

  // Müşteri + geçmiş çek
  useEffect(() => {
    if (!callPhone) return;
    setCustomer(null); setHistory([]); setDisp(''); setNote(''); setSaved(false);

    axios.get('/api/customers', { params: { search: callPhone, limit: 1 } })
      .then(({ data }) => { if (data.data?.[0]) setCustomer(data.data[0]); })
      .catch(() => {});

    axios.get(`/api/calls/by-phone/${encodeURIComponent(callPhone)}`)
      .then(({ data }) => setHistory(data))
      .catch(() => {});
  }, [callPhone]);

  const saveDisposition = useCallback(async (disp, keepOpen = false) => {
    if (!callLogId && !callPhone) return;
    setSaving(true);
    try {
      const target = callLogId || history[0]?.id;
      if (target) {
        await axios.patch(`/api/calls/${target}/disposition`, {
          disposition: disp || disposition || undefined,
          notes: note || undefined,
          callback_at: disp === 'callback' && callbackAt ? new Date(callbackAt).toISOString() : undefined,
        });
      }
      if (!keepOpen) setSaved(true);
    } catch {}
    finally { setSaving(false); }
  }, [callLogId, callPhone, disposition, note, callbackAt, history]);

  const handleHangup = async () => {
    if (disposition) await saveDisposition(disposition, true);
    hangup();
    onHangup?.();
  };

  const handleDisp = (key) => {
    setDisp(key);
    if (key !== 'callback') setCallbackAt('');
  };

  const handleTransfer = () => {
    if (!transferExt || !session) return;
    try {
      session.refer(`sip:${transferExt}@${import.meta.env.VITE_SIP_DOMAIN || 'sip9.netsantral.com'}`);
      setShowTransfer(false); setTransferExt('');
    } catch {}
  };

  // Çağrı bittikten sonra paneli açık tut (5 sn)
  const [postCallOpen, setPostCallOpen] = useState(false);
  useEffect(() => {
    if (!session && postCallOpen) {
      const id = setTimeout(() => setPostCallOpen(false), 8000);
      return () => clearTimeout(id);
    }
    if (session) setPostCallOpen(true);
  }, [session]);

  const visible = !!callPhone && (!!session || postCallOpen);
  if (!visible) return null;

  const callEnded = !session && postCallOpen;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className={`flex flex-col bg-white ${compact ? 'rounded-2xl border border-slate-200 shadow-xl w-80' : 'h-full'}`}
    >
      {/* ── Başlık ── */}
      <div className={`flex items-center justify-between px-5 py-4 border-b border-slate-100 ${
        callEnded ? 'bg-slate-50' : isActive ? 'bg-emerald-50' : 'bg-amber-50'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
            callEnded ? 'bg-slate-400' : isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400 animate-pulse'
          }`} />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            {callEnded ? 'Çağrı Bitti' : isActive ? 'Aktif Çağrı' : 'Arıyor...'}
          </span>
        </div>
        <CallTimer active={isActive && !callEnded} />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Müşteri ── */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {(customer?.name || callPhone).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              {customer ? (
                <>
                  <div className="text-base font-bold text-slate-900 truncate">
                    {customer.name} {customer.surname}
                  </div>
                  {customer.company && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <Building2 size={11} /> {customer.company}
                    </div>
                  )}
                  {customer.email && (
                    <div className="text-xs text-slate-400 mt-0.5">{customer.email}</div>
                  )}
                  {customer.notes && (
                    <div className="text-xs text-slate-500 mt-1 italic bg-slate-50 rounded-lg px-2 py-1">
                      {customer.notes}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-slate-500">Müşteri kaydı bulunamadı</div>
              )}
              <div className="font-mono text-sm font-semibold text-slate-800 mt-1">{callPhone}</div>
            </div>
          </div>
        </div>

        {/* ── Sonuç seç ── */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Görüşme Sonucu</div>
          <div className="grid grid-cols-2 gap-2">
            {DISPOSITIONS.map(({ key, label, icon: Icon, color }) => {
              const isSelected = disposition === key;
              return (
                <button
                  key={key}
                  onClick={() => handleDisp(key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                    isSelected
                      ? `${D_COLOR[color]} ring-2`
                      : D_COLOR_IDLE
                  }`}
                >
                  <Icon size={13} className="flex-shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Callback datetime */}
          <AnimatePresence>
            {disposition === 'callback' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-3"
              >
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Tekrar Arama Tarihi</label>
                <input
                  type="datetime-local"
                  value={callbackAt}
                  onChange={e => setCallbackAt(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-violet-400"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Not ── */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Görüşme Notu</span>
            {saved && <span className="text-xs text-emerald-600 font-medium">✓ Kaydedildi</span>}
          </div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Görüşme hakkında not..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 resize-none focus:outline-none focus:border-slate-400 placeholder:text-slate-400"
          />
        </div>

        {/* ── Geçmiş aramalar ── */}
        {history.length > 0 && (
          <div className="px-5 py-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Geçmiş Aramalar ({history.length})
            </div>
            <div>
              {history.slice(0, 5).map(h => <HistoryRow key={h.id} call={h} />)}
            </div>
          </div>
        )}
      </div>

      {/* ── Alt kontroller ── */}
      <div className="px-5 py-4 border-t border-slate-100 space-y-2">
        {/* Transfer */}
        <AnimatePresence>
          {showTransfer && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex gap-2 overflow-hidden"
            >
              <input
                value={transferExt}
                onChange={e => setTransferExt(e.target.value)}
                placeholder="Transfer dahilisi"
                className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500 placeholder:text-slate-400"
              />
              <button onClick={handleTransfer} disabled={!transferExt}
                className="px-4 py-2 bg-slate-900 rounded-lg text-sm text-white font-medium disabled:opacity-40 hover:bg-slate-800">
                Gönder
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!callEnded ? (
          <div className="flex gap-2">
            <button
              onClick={toggleMute}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                muted ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {muted ? <MicOff size={14} /> : <Mic size={14} />}
              {muted ? 'Açık' : 'Sessiz'}
            </button>
            <button
              onClick={() => setShowTransfer(!showTransfer)}
              className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              title="Transfer"
            >
              <ArrowRightLeft size={14} />
            </button>
            <button
              onClick={handleHangup}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-colors"
            >
              <PhoneOff size={14} />
              Kapat
            </button>
          </div>
        ) : (
          <button
            onClick={() => saveDisposition(disposition)}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            <Save size={14} />
            {saving ? 'Kaydediliyor...' : 'Sonucu Kaydet ve Kapat'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
