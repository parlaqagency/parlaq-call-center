import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, MicOff, Mic, PhoneOff, ArrowRightLeft } from 'lucide-react';
import axios from 'axios';
import { useSipStore } from '../../store/sipStore';
import { useAuthStore } from '../../store/authStore';

function ActiveCallControls() {
  const { callStatus, callPhone, muted, session, incomingSession, hangup, toggleMute, transferCall } = useSipStore();
  const sipStore = useSipStore();
  const [transferExt, setTransferExt] = useState('');
  const [transferring, setTransferring] = useState(false);

  const hasCall = !!session || !!incomingSession;
  if (!hasCall && callStatus === null) return null;

  const handleTransfer = async () => {
    if (!transferExt || !session) return;
    try {
      setTransferring(true);
      // JsSIP REFER based transfer
      session.refer(`sip:${transferExt}@${import.meta.env.VITE_SIP_DOMAIN || 'sip9.netsantral.com'}`);
      setTransferExt('');
    } catch (e) {
      console.warn('Transfer hatası:', e);
    } finally {
      setTransferring(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-sm font-medium text-emerald-700">
          {callStatus === 'calling' ? 'Arıyor...' : callStatus === 'active' ? 'Bağlantı Kuruldu' : 'Çağrı'}
        </span>
        <span className="text-sm text-slate-500 font-mono ml-auto">{callPhone}</span>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={toggleMute}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm border transition-colors ${
            muted ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {muted ? <MicOff size={14} /> : <Mic size={14} />}
          {muted ? 'Sessizden Çık' : 'Sessize Al'}
        </button>
        <button
          onClick={hangup}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
        >
          <PhoneOff size={14} />
          Sonlandır
        </button>
      </div>
      <div className="flex gap-2 mt-2">
        <input
          value={transferExt}
          onChange={e => setTransferExt(e.target.value)}
          placeholder="Transfer — dahili numara"
          className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-500 placeholder:text-slate-400"
        />
        <button
          onClick={handleTransfer}
          disabled={!transferExt || transferring}
          className="px-4 py-2 bg-slate-900 rounded-lg text-sm text-white disabled:opacity-40 hover:bg-slate-800 transition-colors flex items-center gap-1.5"
        >
          <ArrowRightLeft size={14} />
          Transfer
        </button>
      </div>
    </motion.div>
  );
}

export default function CallDialer({ agentId, agentExtension, prefillPhone, onPhoneUsed }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { makeCall, registered, callStatus } = useSipStore();
  const isBusy = callStatus !== null;
  const userRole = useAuthStore(s => s.agent?.role);

  useEffect(() => {
    if (prefillPhone) { setPhone(prefillPhone); onPhoneUsed?.(); }
  }, [prefillPhone]);

  const handleCall = async () => {
    if (!phone.trim()) return;
    setError(''); setLoading(true);
    try {
      if (registered) {
        // JsSIP üzerinden ara + CDR kaydı
        const { data: logEntry } = await axios.post('/api/calls/log', {
          customerPhone: phone.trim(),
          direction: 'outbound',
        });
        makeCall(phone.trim(), logEntry?.id);
      } else {
        // Fallback: Netgsm HTTP API
        await axios.post('/api/calls/start', {
          customerPhone: phone.trim(),
          extensionNumber: agentExtension,
          agentId,
        });
      }
    } catch (e) {
      setError(e.response?.data?.error || 'Çağrı başlatılamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Yeni Çağrı</h3>
        {userRole !== 'admin' && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            registered ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
          }`}>
            {registered ? 'SIP Kayıtlı' : 'SIP Bağlı Değil'}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !isBusy && handleCall()}
          placeholder="0532 xxx xx xx"
          disabled={isBusy}
          className="flex-1 bg-white border border-slate-300 rounded-lg px-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400 transition-colors placeholder:text-slate-400"
        />
        <button
          onClick={handleCall}
          disabled={loading || isBusy || !phone}
          className="px-6 py-3 bg-slate-900 rounded-lg text-white text-sm font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40 flex items-center gap-2"
        >
          <Phone size={15} />
          {loading ? 'Arıyor...' : 'Ara'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <ActiveCallControls />
    </div>
  );
}
