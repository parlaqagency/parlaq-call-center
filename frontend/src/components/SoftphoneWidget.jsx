import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, PhoneCall, Wifi, WifiOff, ClipboardList } from 'lucide-react';
import { useSipStore } from '../store/sipStore';
import CallInfoPanel from './CallInfoPanel';

function CallTimer({ active }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) { setSecs(0); return; }
    const id = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">{m}:{s}</span>;
}

// Zil sesi (Web Audio API)
function useRinger(active) {
  useEffect(() => {
    if (!active) return;
    let ctx, nodes = [], stopped = false;
    const ring = () => {
      if (stopped) return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 480; osc.type = 'sine';
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.6);
      nodes.push(osc);
    };
    ring();
    const id = setInterval(ring, 1800);
    return () => {
      stopped = true;
      clearInterval(id);
      nodes.forEach(n => { try { n.stop(); } catch {} });
      try { ctx?.close(); } catch {}
    };
  }, [active]);
}

// Çalıyor sesi / Geri arama sesi (Web Audio API)
function useRingback(active) {
  useEffect(() => {
    if (!active) return;
    let ctx, stopped = false;
    let timerId = null;

    const playTone = () => {
      if (stopped) return;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.value = 425; // Standart Türk/Avrupa santral çalıyor sesi frekansı
        osc.type = 'sine';

        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        // Yumuşak geçişli 1 saniyelik ses dalgası (tık seslerini önlemek için linearRamp)
        gain.gain.linearRampToValueAtTime(0.08, now + 0.05); // volume
        gain.gain.setValueAtTime(0.08, now + 0.95);
        gain.gain.linearRampToValueAtTime(0, now + 1.0);

        osc.start(now);
        osc.stop(now + 1.0);
      } catch (err) {
        console.warn('Ringback Web Audio error:', err);
      }
    };

    playTone();
    timerId = setInterval(playTone, 4000); // 1 saniye ses + 3 saniye sessizlik = 4 saniye periyot

    return () => {
      stopped = true;
      if (timerId) clearInterval(timerId);
      try {
        ctx?.close();
      } catch {}
    };
  }, [active]);
}

export default function SoftphoneWidget() {
  const { registered, registering, callStatus, callPhone, muted, session, incomingSession, answer, reject, hangup, toggleMute } = useSipStore();
  const [expanded, setExpanded] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const callLogId = useSipStore(s => s.callLogId);

  const hasIncoming = !!incomingSession;
  const hasActive   = !!session && callStatus !== null;

  // Gelen çağrı olunca otomatik aç
  useEffect(() => { if (hasIncoming) setExpanded(true); }, [hasIncoming]);

  useRinger(hasIncoming);
  useRingback(callStatus === 'calling');

  const statusColor = registered ? 'bg-emerald-500' : registering ? 'bg-amber-400 animate-pulse' : 'bg-slate-300';
  const statusText  = registered ? 'Kayıtlı' : registering ? 'Bağlanıyor...' : 'Bağlı Değil';

  return (
    <div className="fixed bottom-5 right-5 z-[150] flex flex-col items-end gap-2">
      <AnimatePresence mode="wait">
        {/* Gelen çağrı */}
        {hasIncoming && (
          <motion.div
            key="incoming"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="bg-white border border-slate-200 rounded-2xl shadow-xl w-72 overflow-hidden"
          >
            <div className="h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <PhoneCall size={18} className="text-emerald-600 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Gelen Çağrı</div>
                  <div className="text-base font-bold text-slate-900 font-mono">{callPhone}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={answer}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition-colors"
                >
                  <Phone size={14} /> Cevapla
                </button>
                <button
                  onClick={reject}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
                >
                  <PhoneOff size={14} /> Reddet
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Aktif çağrı */}
        {hasActive && !hasIncoming && (
          <motion.div
            key="active"
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="bg-white border border-emerald-200 rounded-2xl shadow-xl w-64 p-4"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                {callStatus === 'calling' ? 'Arıyor...' : 'Aktif Çağrı'}
              </span>
              <CallTimer active={callStatus === 'active'} />
            </div>
            <div className="text-sm font-bold text-slate-900 font-mono mb-3">{callPhone}</div>
            <div className="flex gap-2">
              <button
                onClick={toggleMute}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs font-medium transition-colors ${
                  muted ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {muted ? <MicOff size={13} /> : <Mic size={13} />}
                {muted ? 'Açık' : 'Sessiz'}
              </button>
              <button
                onClick={() => setShowCard(true)}
                className="px-2 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors"
                title="Çağrı Kartı"
              >
                <ClipboardList size={13} />
              </button>
              <button
                onClick={hangup}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors"
              >
                <PhoneOff size={13} /> Kapat
              </button>
            </div>
          </motion.div>
        )}

        {/* Çağrı kartı overlay (admin için) */}
        <AnimatePresence>
          {showCard && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-end p-4"
              onClick={() => setShowCard(false)}
            >
              <motion.div
                initial={{ x: 80, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 80, opacity: 0 }}
                className="h-full max-h-[90vh] w-80 overflow-hidden rounded-2xl shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <CallInfoPanel
                  callLogId={callLogId}
                  compact
                  onHangup={() => setShowCard(false)}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </AnimatePresence>

    </div>
  );
}
