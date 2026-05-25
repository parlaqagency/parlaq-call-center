import { useEffect, useState } from 'react';
import { RefreshCw, PhoneIncoming, PhoneOutgoing, Play, Loader2, AlertCircle } from 'lucide-react';
import { useCallStore } from '../../store/callStore';
import axios from 'axios';
import MiniAudioPlayer from './MiniAudioPlayer';

const STATUS_STYLE = {
  answered: { text: 'Cevaplandı', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  missed: { text: 'Cevapsız', cls: 'bg-red-50 text-red-700 border-red-200' },
  busy: { text: 'Meşgul', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  ringing: { text: 'Çalıyor', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
};

function formatDuration(seconds) {
  if (!seconds) return '—';
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function CallHistory() {
  const history = useCallStore(s => s.callHistory);
  const fetchHistory = useCallStore(s => s.fetchHistory);

  const [activePlayerId, setActivePlayerId] = useState(null);
  const [recordingUrls, setRecordingUrls] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [errorId, setErrorId] = useState(null);

  useEffect(() => { fetchHistory(); }, []);

  const handlePlayClick = async (callId, existingUrl) => {
    if (activePlayerId === callId) {
      setActivePlayerId(null);
      return;
    }

    if (existingUrl || recordingUrls[callId]) {
      setActivePlayerId(callId);
      return;
    }

    setLoadingId(callId);
    setErrorId(null);
    try {
      const { data } = await axios.get(`/api/calls/${callId}/recording`);
      if (data.recording_url) {
        setRecordingUrls(prev => ({ ...prev, [callId]: data.recording_url }));
        setActivePlayerId(callId);
      } else {
        setErrorId(callId);
      }
    } catch (err) {
      console.error('[CallHistory] Error fetching recording:', err);
      setErrorId(callId);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Çağrı Geçmişi</h3>
        <button
          onClick={() => fetchHistory()}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          <RefreshCw size={13} />
          Yenile
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-100">
              <th className="px-5 py-3">Numara</th>
              <th className="px-5 py-3">Yön</th>
              <th className="px-5 py-3">Durum</th>
              <th className="px-5 py-3">Süre</th>
              <th className="px-5 py-3">Çalışan</th>
              <th className="px-5 py-3">Tarih</th>
              <th className="px-5 py-3">Kayıt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((c) => {
              const st = STATUS_STYLE[c.status] || { text: c.status, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
              const hasUrl = c.recording_url || recordingUrls[c.id];
              return (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-slate-900 text-sm">{c.customer_phone}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${
                      c.direction === 'inbound'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-violet-50 text-violet-700 border-violet-200'
                    }`}>
                      {c.direction === 'inbound'
                        ? <><PhoneIncoming size={11} /> Gelen</>
                        : <><PhoneOutgoing size={11} /> Giden</>
                      }
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${st.cls}`}>{st.text}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-slate-600 text-xs tabular-nums">{formatDuration(c.duration)}</td>
                  <td className="px-5 py-3 text-slate-600 text-xs">{c.agent_name || '—'}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs">{formatDate(c.started_at)}</td>
                  <td className="px-5 py-3">
                    {c.status === 'answered' ? (
                      activePlayerId === c.id ? (
                        <div className="flex items-center gap-2">
                          <MiniAudioPlayer src={c.recording_url || recordingUrls[c.id]} callId={c.id} />
                          <button 
                            onClick={() => setActivePlayerId(null)}
                            className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                          >
                            Kapat
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePlayClick(c.id, c.recording_url)}
                          disabled={loadingId === c.id}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-all disabled:opacity-50"
                        >
                          {loadingId === c.id ? (
                            <>
                              <Loader2 size={11} className="animate-spin text-slate-500" />
                              Yükleniyor...
                            </>
                          ) : errorId === c.id ? (
                            <>
                              <AlertCircle size={11} className="text-red-500" />
                              Hata
                            </>
                          ) : (
                            <>
                              <Play size={11} fill="currentColor" />
                              Dinle
                            </>
                          )}
                        </button>
                      )
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {history.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-slate-400 text-sm">
                  Çağrı kaydı yok
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
