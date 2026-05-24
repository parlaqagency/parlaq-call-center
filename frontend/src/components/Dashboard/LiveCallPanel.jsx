import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MicOff, Mic, ArrowRightLeft, PhoneOff, PhoneIncoming, PhoneOutgoing } from 'lucide-react';
import { useCallStore } from '../../store/callStore';
import axios from 'axios';

function CallTimer({ startedAt }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = startedAt ? new Date(startedAt).getTime() : Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
  const s = (elapsed % 60).toString().padStart(2, '0');
  return <span className="font-mono text-xs text-slate-500 tabular-nums">{m}:{s}</span>;
}

function LiveCallRow({ call }) {
  const hangupCall = useCallStore(s => s.hangupCall);
  const [muted, setMuted] = useState(false);
  const [transferExt, setTransferExt] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);

  const handleMute = async () => {
    await axios.post('/api/calls/mute', {
      uniqueId: call.unique_id,
      crmId: call.unique_id,
      state: muted ? 'unmute' : 'mute',
    });
    setMuted(!muted);
  };

  const handleTransfer = async () => {
    if (!transferExt) return;
    await axios.post('/api/calls/transfer', {
      uniqueId: call.unique_id,
      crmId: call.unique_id,
      extension: transferExt,
    });
    setShowTransfer(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3 hover:shadow-sm transition-shadow"
    >
      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {call.direction === 'inbound'
            ? <PhoneIncoming size={13} className="text-blue-500 flex-shrink-0" />
            : <PhoneOutgoing size={13} className="text-emerald-500 flex-shrink-0" />
          }
          <span className="text-sm font-medium text-slate-900 truncate">
            {call.agent_name || 'Çalışan'}
          </span>
          <span className="text-slate-300 text-xs">→</span>
          <span className="text-sm text-slate-600 font-mono">{call.customer_phone}</span>
          <CallTimer startedAt={call.started_at} />
        </div>
        {call.status && (
          <div className="text-xs text-slate-400 mt-0.5">
            {call.status === 'ringing' ? 'Çalıyor...' : 'Bağlı'}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleMute}
          className={`p-1.5 rounded-lg border text-xs transition-colors ${
            muted
              ? 'bg-amber-50 border-amber-200 text-amber-600'
              : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
          }`}
          title={muted ? 'Sessize Al' : 'Sessizden Çık'}
        >
          {muted ? <MicOff size={13} /> : <Mic size={13} />}
        </button>
        <button
          onClick={() => setShowTransfer(!showTransfer)}
          className="p-1.5 rounded-lg border bg-white border-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
          title="Transfer"
        >
          <ArrowRightLeft size={13} />
        </button>
        <button
          onClick={hangupCall}
          className="p-1.5 rounded-lg bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-colors"
          title="Kapat"
        >
          <PhoneOff size={13} />
        </button>
      </div>
      {showTransfer && (
        <div className="flex gap-1.5 ml-1">
          <input
            value={transferExt}
            onChange={e => setTransferExt(e.target.value)}
            placeholder="Dahili"
            className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-slate-500"
          />
          <button
            onClick={handleTransfer}
            className="px-2.5 py-1.5 bg-slate-900 rounded-lg text-xs text-white hover:bg-slate-800"
          >
            Gönder
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function LiveCallPanel() {
  const activeCalls = useCallStore(s => s.activeCalls);
  const fetchActiveCalls = useCallStore(s => s.fetchActiveCalls);

  useEffect(() => {
    fetchActiveCalls();
    const id = setInterval(fetchActiveCalls, 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Canlı Çağrılar</h3>
        {activeCalls.length > 0 && (
          <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">
            {activeCalls.length}
          </span>
        )}
      </div>
      <div className="space-y-2">
        <AnimatePresence>
          {activeCalls.map(c => <LiveCallRow key={c.unique_id || c.id} call={c} />)}
          {activeCalls.length === 0 && (
            <div className="text-slate-400 text-sm text-center py-10 border border-dashed border-slate-200 rounded-xl">
              Aktif çağrı yok
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
