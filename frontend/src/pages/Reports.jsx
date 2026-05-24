import { useEffect, useState } from 'react';
import { Download, Search, X, BarChart2, PhoneIncoming, PhoneOutgoing, PhoneMissed, Users } from 'lucide-react';
import axios from 'axios';
import { useCallStore } from '../store/callStore';
import StatsChart from '../components/StatsChart';

function formatDuration(s) {
  if (!s) return '—';
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const DISP_LABELS = {
  interested:     'İlgileniyor',
  not_interested: 'İlgilenmiyor',
  appointment:    'Randevu',
  callback:       'Geri Ara',
  no_audio:       'Ses Yok',
  busy:           'Meşgul',
  no_answer:      'Cevap Yok',
  wrong_number:   'Yanlış No',
  answered:       'Cevaplandı',
  missed:         'Cevapsız',
};

const DISP_COLORS = {
  interested:     'bg-emerald-500',
  not_interested: 'bg-red-400',
  appointment:    'bg-blue-500',
  callback:       'bg-violet-500',
  no_audio:       'bg-slate-300',
  busy:           'bg-amber-400',
  no_answer:      'bg-orange-400',
  wrong_number:   'bg-pink-400',
  answered:       'bg-emerald-400',
  missed:         'bg-red-500',
};

function DispositionChart({ period }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    axios.get('/api/reports/dispositions', { params: { period } })
      .then(({ data }) => setData(data))
      .catch(() => {});
  }, [period]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 text-sm py-10">Veri yok</div>;
  }

  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="space-y-2.5">
      {data.map(d => (
        <div key={d.disposition} className="flex items-center gap-3">
          <div className="w-28 text-xs text-slate-600 font-medium text-right flex-shrink-0">
            {DISP_LABELS[d.disposition] || d.disposition}
          </div>
          <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
            <div
              className={`h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500 ${DISP_COLORS[d.disposition] || 'bg-slate-400'}`}
              style={{ width: `${Math.max(4, (d.count / max) * 100)}%` }}
            >
              <span className="text-white text-xs font-bold tabular-nums leading-none">{d.count}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentPerformanceTable({ period }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    axios.get('/api/reports/agent-performance', { params: { period } })
      .then(({ data }) => setData(data))
      .catch(() => {});
  }, [period]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-100">
            {['#', 'Çalışan', 'Dahili', 'Toplam', 'Cevaplanan', 'Gelen', 'Giden', 'Ort. Süre', 'Yanıt Oranı'].map(h => (
              <th key={h} className="px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((a, i) => (
            <tr key={a.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-xs font-bold text-slate-400 tabular-nums">{i + 1}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {a.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-slate-900">{a.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{a.extension}</td>
              <td className="px-4 py-3 font-bold text-slate-900 tabular-nums">{a.total}</td>
              <td className="px-4 py-3 text-emerald-700 tabular-nums">{a.answered}</td>
              <td className="px-4 py-3 text-blue-600 tabular-nums">{a.inbound}</td>
              <td className="px-4 py-3 text-violet-600 tabular-nums">{a.outbound}</td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums">{formatDuration(a.avg_duration)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 w-16">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${a.answer_rate}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-600 tabular-nums w-8">%{a.answer_rate}</span>
                </div>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">Veri yok</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Reports() {
  const history = useCallStore(s => s.callHistory);
  const fetchHistory = useCallStore(s => s.fetchHistory);
  const stats = useCallStore(s => s.todayStats);
  const fetchTodayStats = useCallStore(s => s.fetchTodayStats);
  const [phone, setPhone] = useState('');
  const [period, setPeriod] = useState('today');

  useEffect(() => {
    fetchHistory();
    fetchTodayStats();
  }, []);

  const search = () => fetchHistory({ phone: phone || undefined });

  const answered = Number(stats?.answered || 0);
  const total = Number(stats?.total || 0);
  const rate = total ? Math.round((answered / total) * 100) : 0;

  const handleExport = () => {
    window.location.href = `/api/reports/cdr/export${phone ? `?phone=${phone}` : ''}`;
  };

  return (
    <div className="p-6 space-y-5">
      <StatsChart />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Bugün Toplam', value: total, icon: BarChart2, color: 'bg-slate-100 text-slate-600' },
          { label: 'Cevaplanan', value: answered, icon: PhoneIncoming, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Cevapsız', value: Number(stats?.missed || 0), icon: PhoneMissed, color: 'bg-red-50 text-red-500' },
          { label: 'Yanıt Oranı', value: `%${rate}`, icon: PhoneOutgoing, color: 'bg-blue-50 text-blue-600' },
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

      {/* Period toggle */}
      <div className="flex items-center gap-2">
        {[{ key: 'today', label: 'Bugün' }, { key: 'week', label: 'Bu Hafta' }].map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p.key
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Disposition Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Çağrı Sonuçları Dağılımı</h3>
          <DispositionChart period={period} />
        </div>

        {/* Agent Performance */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <Users size={14} className="text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-900">Ajan Performansı</h3>
          </div>
          <AgentPerformanceTable period={period} />
        </div>
      </div>

      {/* CDR Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-900 flex-1">CDR — Çağrı Kayıtları</h3>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Numaraya göre ara"
              className="bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-900 w-48 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
            />
          </div>
          <button onClick={search} className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">Ara</button>
          {phone && (
            <button onClick={() => { setPhone(''); fetchHistory(); }} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={14} />
            </button>
          )}
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors">
            <Download size={14} />
            CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-100">
                {['Numara', 'Yön', 'Durum', 'Süre', 'Çalışan', 'Başlangıç'].map(h => (
                  <th key={h} className="px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-slate-900">{c.customer_phone}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${
                      c.direction === 'inbound'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-violet-50 text-violet-700 border-violet-200'
                    }`}>
                      {c.direction === 'inbound'
                        ? <><PhoneIncoming size={11} /> Gelen</>
                        : <><PhoneOutgoing size={11} /> Giden</>}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">{c.status}</td>
                  <td className="px-5 py-3 font-mono text-slate-600 text-xs tabular-nums">{formatDuration(c.duration)}</td>
                  <td className="px-5 py-3 text-slate-500 text-sm">{c.agent_name || '—'}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs">{formatDate(c.started_at)}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">Kayıt yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
