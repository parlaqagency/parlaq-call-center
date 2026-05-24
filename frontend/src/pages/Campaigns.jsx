import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import {
  Play, Pause, Square, Trash2, Upload, Phone, CheckCircle,
  PhoneMissed, Clock, Users, Zap, X,
} from 'lucide-react';
import { useCampaignStore } from '../store/campaignStore';

// ── CSV Parse ────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\r"]/g, ''));
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/[\r"]/g, ''));
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] || ''; });
    return {
      phone: row['telefon'] || row['phone'] || row['tel'] || '',
      name:  row['ad'] || row['name'] || row['isim'] || '',
    };
  }).filter(r => r.phone.trim());
}

const STATUS_CFG = {
  pending:   { label: 'Bekliyor',     cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  running:   { label: 'Çalışıyor',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  paused:    { label: 'Duraklatıldı', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  completed: { label: 'Tamamlandı',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  stopped:   { label: 'Durduruldu',   cls: 'bg-red-50 text-red-600 border-red-200' },
};

// ── Create Campaign Modal ────────────────────────────────────────
function CreateModal({ onClose }) {
  const createCampaign = useCampaignStore(s => s.createCampaign);
  const fileRef = useRef();
  const [name, setName] = useState('');
  const [contacts, setContacts] = useState([]);
  const [preview, setPreview] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      if (!rows.length) { setError('Geçerli telefon bulunamadı. Kolon: telefon veya phone'); return; }
      setContacts(rows);
      setPreview(rows.slice(0, 6));
      setError('');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Kampanya adı zorunlu');
    if (!contacts.length) return setError('CSV yüklenmedi');
    setLoading(true);
    try {
      await createCampaign({ name: name.trim(), contacts });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-slate-900">Yeni Kampanya</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Kampanya Adı</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ör: Mayıs Kampanyası"
              autoFocus
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Aranacaklar Listesi (CSV)
              <span className="ml-1 text-slate-400 font-normal">— Kolon: <code className="bg-slate-100 px-1 rounded">telefon</code> (zorunlu), <code className="bg-slate-100 px-1 rounded">ad</code> (isteğe bağlı)</span>
            </label>
            <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50">
              <Upload size={22} className="text-slate-400 mb-1.5" />
              <div className="text-sm font-medium text-slate-600">
                {contacts.length ? `${contacts.length} kişi yüklendi` : 'CSV dosyası seç'}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">.csv, UTF-8</div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>
          </div>

          {preview.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 text-xs font-medium text-slate-500 border-b border-slate-200">
                Önizleme — ilk {preview.length} kayıt
              </div>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {preview.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-mono text-slate-700">{r.phone}</td>
                      <td className="px-3 py-2 text-slate-500">{r.name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200">İptal</button>
            <button type="submit" disabled={loading || !contacts.length}
              className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-40">
              {loading ? 'Oluşturuluyor...' : `Kampanya Oluştur (${contacts.length} kişi)`}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Live Call Log ────────────────────────────────────────────────
function LiveLog({ logs }) {
  if (!logs.length) return null;
  return (
    <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
      {logs.map((l, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />
          <span className="font-mono">{l.phone}</span>
          <span className="text-slate-400">→ dahili {l.extension}</span>
          <span className="ml-auto text-slate-400">{new Date(l.ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
      ))}
    </div>
  );
}

// ── Campaign Row ─────────────────────────────────────────────────
function CampaignRow({ campaign, logs }) {
  const { startCampaign, pauseCampaign, stopCampaign, deleteCampaign } = useCampaignStore();
  const [confirming, setConfirming] = useState(false);

  const st = STATUS_CFG[campaign.status] || STATUS_CFG.pending;
  const total    = Number(campaign.total_contacts) || 1;
  const called   = Number(campaign.called_count) || 0;
  const answered = Number(campaign.answered_contacts || campaign.answered_count) || 0;
  const missed   = Number(campaign.missed) || 0;
  const calling  = Number(campaign.calling) || 0;
  const pct      = Math.round((called / total) * 100);
  const myLogs   = (logs || []).filter(l => l.campaignId === campaign.id).slice(-5).reverse();

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-slate-900">{campaign.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${st.cls}`}>{st.label}</span>
            {calling > 0 && (
              <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                {calling} aktif
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-2 mb-2">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{called} / {total} arandı</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-slate-900 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs mt-2">
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle size={11} /> {answered} cevap
            </span>
            <span className="flex items-center gap-1 text-red-500">
              <PhoneMissed size={11} /> {missed} cevapsız
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <Users size={11} /> {total} toplam
            </span>
            {campaign.created_by_name && (
              <span className="text-slate-400 ml-auto">{campaign.created_by_name}</span>
            )}
          </div>

          {/* Live log (running only) */}
          {campaign.status === 'running' && <LiveLog logs={myLogs} />}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {campaign.status === 'pending' && (
            <button onClick={() => startCampaign(campaign.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors">
              <Play size={13} /> Başlat
            </button>
          )}
          {campaign.status === 'running' && (
            <button onClick={() => pauseCampaign(campaign.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors">
              <Pause size={13} /> Duraklat
            </button>
          )}
          {campaign.status === 'paused' && (
            <button onClick={() => startCampaign(campaign.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors">
              <Play size={13} /> Devam Et
            </button>
          )}
          {['running', 'paused'].includes(campaign.status) && (
            <button onClick={() => stopCampaign(campaign.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">
              <Square size={13} /> Durdur
            </button>
          )}
          {!confirming ? (
            <button onClick={() => setConfirming(true)}
              className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
              <Trash2 size={13} />
            </button>
          ) : (
            <div className="flex gap-1">
              <button onClick={() => deleteCampaign(campaign.id)} className="px-2 py-1 bg-red-500 text-white rounded-lg text-xs font-medium">Sil</button>
              <button onClick={() => setConfirming(false)} className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs">İptal</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────
export default function Campaigns() {
  const { campaigns, fetchCampaigns, updateStats, markCompleted } = useCampaignStore();
  const [showCreate, setShowCreate] = useState(false);
  const [liveLogs, setLiveLogs]     = useState([]); // { campaignId, phone, extension, ts }
  const socketRef = useRef(null);

  // Socket bağlantısı — sadece bu sayfada
  useEffect(() => {
    fetchCampaigns();
    const socket = io('http://localhost:3001');
    socketRef.current = socket;

    socket.on('campaign_stats', (data) => updateStats(data.campaignId, data));
    socket.on('campaign_completed', ({ campaignId }) => markCompleted(campaignId));
    socket.on('campaign_call_started', ({ campaignId, phone, extension }) => {
      setLiveLogs(l => [{ campaignId, phone, extension, ts: Date.now() }, ...l].slice(0, 50));
    });

    return () => socket.disconnect();
  }, []);

  const running  = campaigns.filter(c => c.status === 'running').length;
  const total    = campaigns.reduce((s, c) => s + Number(c.total_contacts || 0), 0);
  const answered = campaigns.reduce((s, c) => s + Number(c.answered_contacts || c.answered_count || 0), 0);

  return (
    <div className="p-6 space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Aktif Kampanya', value: running,  icon: Zap,   color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Toplam Kişi',    value: total,    icon: Users, color: 'bg-blue-50 text-blue-600' },
          { label: 'Cevaplanan',     value: answered, icon: Phone, color: 'bg-violet-50 text-violet-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">{label}</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                <Icon size={14} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Kampanyalar</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-lg text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
        >
          <Upload size={14} />
          Yeni Kampanya
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        <AnimatePresence>
          {campaigns.map(c => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <CampaignRow campaign={c} logs={liveLogs} />
            </motion.div>
          ))}
        </AnimatePresence>
        {campaigns.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-14 text-center shadow-sm">
            <Zap size={32} className="mx-auto text-slate-300 mb-3" />
            <div className="text-sm font-medium text-slate-500">Henüz kampanya yok</div>
            <div className="text-xs text-slate-400 mt-1">CSV yükleyerek otomatik arama kampanyası başlatın</div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && <CreateModal onClose={() => { setShowCreate(false); fetchCampaigns(); }} />}
      </AnimatePresence>
    </div>
  );
}
