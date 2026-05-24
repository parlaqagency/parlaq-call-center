import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff } from 'lucide-react';
import { useCallStore } from '../store/callStore';
import { useSipStore } from '../store/sipStore';

function useRinger(active) {
  const ctx = useRef(null);
  const nodes = useRef([]);

  const stop = () => {
    nodes.current.forEach(n => { try { n.stop(); } catch {} });
    nodes.current = [];
  };

  useEffect(() => {
    if (!active) { stop(); return; }

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.current = audioCtx;

    const ring = () => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 480;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.5);
      nodes.current.push(osc);
    };

    ring();
    const id = setInterval(ring, 1500);
    return () => { clearInterval(id); stop(); audioCtx.close(); };
  }, [active]);
}

export default function IncomingCallAlert() {
  const activeCalls = useCallStore(s => s.activeCalls);
  const removeCall = useCallStore(s => s.removeCall);
  const incomingSession = useSipStore(s => s.incomingSession);

  const incomingCalls = activeCalls.filter(c => c.direction === 'inbound' && c.status === 'ringing');
  // SoftphoneWidget already handles the call when JsSIP session is active — suppress duplicate UI
  useRinger(incomingCalls.length > 0 && !incomingSession);

  if (incomingSession) return null;

  return (
    <div className="fixed top-5 right-5 z-[100] space-y-3 pointer-events-none">
      <AnimatePresence>
        {incomingCalls.map(call => (
          <motion.div
            key={call.unique_id || call.id}
            initial={{ opacity: 0, x: 80, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            className="pointer-events-auto w-80 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="h-0.5 bg-gradient-to-r from-emerald-400 to-blue-500" />
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <Phone size={18} className="text-emerald-600 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-0.5">Gelen Çağrı</div>
                  <div className="text-base font-bold text-slate-900 truncate">
                    {call.customer_phone || call.callerid || 'Bilinmeyen'}
                  </div>
                  {call.queue && <div className="text-xs text-slate-400 mt-0.5">Kuyruk: {call.queue}</div>}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => { useSipStore.getState().answer?.(); removeCall(call.unique_id); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors"
                >
                  <Phone size={14} />
                  Cevapla
                </button>
                <button
                  onClick={() => { useSipStore.getState().reject?.(); removeCall(call.unique_id); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
                >
                  <PhoneOff size={14} />
                  Reddet
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
