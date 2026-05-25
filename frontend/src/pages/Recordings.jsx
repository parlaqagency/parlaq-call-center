import { useEffect, useState } from 'react';
import { Search, Play, Loader2, AlertCircle, RefreshCw, PhoneIncoming, PhoneOutgoing, User, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import MiniAudioPlayer from '../components/Calls/MiniAudioPlayer';

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('tr-TR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

export default function Recordings() {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agents, setAgents] = useState([]);
  
  // Audio Player states
  const [activePlayerId, setActivePlayerId] = useState(null);
  const [recordingUrls, setRecordingUrls] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [errorId, setErrorId] = useState(null);

  // Fetch agents for dropdown
  useEffect(() => {
    axios.get('/api/agents')
      .then(({ data }) => setAgents(data.filter(a => a.role !== 'admin')))
      .catch((err) => console.error('[Recordings] Error fetching agents:', err));
  }, []);

  const fetchRecordings = async (searchParams = {}) => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/calls/history', {
        params: {
          onlyRecordings: true,
          phone: searchParams.phone || undefined,
          agentId: searchParams.agentId || undefined,
          limit: 100
        }
      });
      setRecordings(data);
    } catch (err) {
      console.error('[Recordings] Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordings({ phone, agentId });
  }, [agentId]);

  const handleSearch = () => {
    fetchRecordings({ phone, agentId });
  };

  const handleClear = () => {
    setPhone('');
    setAgentId('');
    fetchRecordings({ phone: '', agentId: '' });
  };

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
      console.error('[Recordings] Error fetching recording:', err);
      setErrorId(callId);
    } finally {
      setLoadingId(null);
    }
  };

  // Stats calculation
  const totalCalls = recordings.length;
  const totalSeconds = recordings.reduce((acc, c) => acc + (c.duration || 0), 0);
  const avgDuration = totalCalls ? Math.round(totalSeconds / totalCalls) : 0;

  return (
    <div className="p-6 space-y-6">
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { label: 'Toplam Ses Kaydı', value: totalCalls, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
          { label: 'Toplam Dinleme Süresi', value: formatDuration(totalSeconds), icon: Clock, color: 'bg-blue-50 text-blue-600 border-blue-100' },
          { label: 'Ortalama Çağrı Süresi', value: formatDuration(avgDuration), icon: Calendar, color: 'bg-violet-50 text-violet-600 border-violet-100' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${color}`}>
              <Icon size={18} />
            </div>
            <div>
              <span className="text-xs font-medium text-slate-500 block">{label}</span>
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{value}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3 flex-wrap">
        
        {/* Phone Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Müşteri numarasına göre ara..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 placeholder:text-slate-400"
          />
        </div>

        {/* Agent Filter */}
        <div className="min-w-[180px]">
          <select
            value={agentId}
            onChange={e => setAgentId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-400 cursor-pointer"
          >
            <option value="">Tüm Çalışanlar</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name} (Dahili {a.extension})</option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Ara
        </button>

        {(phone || agentId) && (
          <button
            onClick={handleClear}
            className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-medium transition-colors"
          >
            Temizle
          </button>
        )}

        <button
          onClick={() => fetchRecordings({ phone, agentId })}
          disabled={loading}
          className="p-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-700 transition-colors ml-auto flex-shrink-0 disabled:opacity-50"
          title="Yenile"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Recordings Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-100 uppercase tracking-wider">
                <th className="px-6 py-4">Müşteri</th>
                <th className="px-6 py-4">Yön</th>
                <th className="px-6 py-4">Görüşen</th>
                <th className="px-6 py-4">Süre</th>
                <th className="px-6 py-4">Arama Tarihi</th>
                <th className="px-6 py-4 text-right">Ses Kaydı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 size={24} className="animate-spin text-slate-500" />
                      <span className="text-xs font-medium">Ses kayıtları yükleniyor...</span>
                    </div>
                  </td>
                </tr>
              ) : recordings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400 text-sm">
                    Ses kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                recordings.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Customer */}
                    <td className="px-6 py-4">
                      <div className="font-mono text-slate-900 font-semibold">{c.customer_phone}</div>
                    </td>

                    {/* Direction */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                        c.direction === 'inbound'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-violet-50 text-violet-700 border-violet-200'
                      }`}>
                        {c.direction === 'inbound' ? (
                          <>
                            <PhoneIncoming size={11} />
                            Gelen
                          </>
                        ) : (
                          <>
                            <PhoneOutgoing size={11} />
                            Giden
                          </>
                        )}
                      </span>
                    </td>

                    {/* Agent */}
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200 text-[10px] font-bold">
                          {c.agent_name?.charAt(0) || <User size={10} />}
                        </div>
                        <span className="font-medium text-slate-900 text-xs">{c.agent_name || 'Santral Sistemi'}</span>
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-slate-600 tabular-nums font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {formatDuration(c.duration)}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                      {formatDate(c.started_at)}
                    </td>

                    {/* Action Player */}
                    <td className="px-6 py-4 text-right">
                      {activePlayerId === c.id ? (
                        <div className="inline-flex items-center gap-3">
                          <MiniAudioPlayer src={c.recording_url || recordingUrls[c.id]} callId={c.id} />
                          <button 
                            onClick={() => setActivePlayerId(null)}
                            className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            Kapat
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePlayClick(c.id, c.recording_url)}
                          disabled={loadingId === c.id}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm transition-all disabled:opacity-50"
                        >
                          {loadingId === c.id ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Yükleniyor
                            </>
                          ) : errorId === c.id ? (
                            <>
                              <AlertCircle size={12} className="text-red-300" />
                              Hata
                            </>
                          ) : (
                            <>
                              <Play size={12} fill="currentColor" />
                              Dinle
                            </>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
