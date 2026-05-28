import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Upload, Phone, Pencil, Trash2, X, Users, PhoneIncoming, PhoneOutgoing, ShieldAlert } from 'lucide-react';
import { useCustomerStore } from '../store/customerStore';
import { useCallStore } from '../store/callStore';
import { useAgentStore } from '../store/agentStore';

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\r"]/g, ''));
  return lines.slice(1).map(line => {
    const cols = line.split(',').map(c => c.trim().replace(/[\r"]/g, ''));
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] || ''; });
    return {
      name: row['ad'] || row['name'] || '',
      surname: row['soyad'] || row['surname'] || '',
      phone: row['telefon'] || row['phone'] || '',
      company: row['şirket'] || row['sirket'] || row['company'] || '',
      notes: row['notlar'] || row['notes'] || '',
      email: row['email'] || row['e-posta'] || '',
    };
  }).filter(r => r.phone);
}

function CSVImport({ onClose }) {
  const bulkImport = useCustomerStore(s => s.bulkImport);
  const [preview, setPreview] = useState([]);
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const inputRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target.result);
      setPreview(rows.slice(0, 5));
      setError(rows.length === 0 ? 'Geçerli satır bulunamadı. Kolon adları: ad, soyad, telefon, şirket, notlar' : '');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    const file = inputRef.current.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rows = parseCSV(ev.target.result);
      setStatus('loading');
      try {
        const imported = await bulkImport(rows);
        setResult(imported);
        setStatus('done');
      } catch (e) {
        setError(e.response?.data?.error || 'İçe aktarma başarısız');
        setStatus('idle');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-slate-900">CSV ile Toplu İçe Aktar</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <p className="text-xs text-slate-500 mb-5">Kolon sırası: <span className="text-slate-700 font-mono">ad, soyad, telefon, şirket, notlar</span></p>

        {status === 'done' ? (
          <div className="text-center py-8">
            <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">✓</span>
            </div>
            <div className="text-slate-900 font-semibold">{result} müşteri içe aktarıldı</div>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-900 rounded-lg text-white text-sm font-medium hover:bg-slate-800">Kapat</button>
          </div>
        ) : (
          <>
            <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 bg-slate-50">
              <Upload size={24} className="text-slate-400 mb-2" />
              <div className="text-sm font-medium text-slate-600">CSV dosyası seç</div>
              <div className="text-xs text-slate-400 mt-1">.csv formatı, UTF-8</div>
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            </label>

            {preview.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium text-slate-500 mb-2">Önizleme — ilk {preview.length} satır</div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-200 bg-white">
                        {['Ad', 'Soyad', 'Telefon', 'Şirket'].map(h => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {preview.map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-slate-700">{r.name}</td>
                          <td className="px-3 py-2 text-slate-700">{r.surname}</td>
                          <td className="px-3 py-2 font-mono text-slate-600">{r.phone}</td>
                          <td className="px-3 py-2 text-slate-500">{r.company}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-red-600 mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200">İptal</button>
              <button
                onClick={handleImport}
                disabled={!preview.length || status === 'loading'}
                className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-40 hover:bg-slate-800"
              >
                {status === 'loading' ? 'İçe Aktarılıyor...' : 'İçe Aktar'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

function CustomerModal({ customer, onClose }) {
  const createCustomer = useCustomerStore(s => s.createCustomer);
  const updateCustomer = useCustomerStore(s => s.updateCustomer);
  const [form, setForm] = useState(customer || { name: '', surname: '', phone: '', email: '', company: '', notes: '' });
  const [error, setError] = useState('');

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (customer) await updateCustomer(customer.id, form);
      else await createCustomer(form);
      onClose();
    } catch (e) {
      setError(e.response?.data?.error || 'Hata oluştu');
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
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-slate-900">{customer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <form onSubmit={handle} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[['Ad', 'name'], ['Soyad', 'surname']].map(([lbl, key]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">{lbl}</label>
                <input value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400" />
              </div>
            ))}
          </div>
          {[['Telefon *', 'phone', 'tel'], ['E-posta', 'email', 'email'], ['Şirket', 'company', 'text']].map(([lbl, key, type]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">{lbl}</label>
              <input type={type} value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required={key === 'phone'}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Notlar</label>
            <textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 resize-none placeholder:text-slate-400" />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200">İptal</button>
            <button type="submit" className="flex-1 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">Kaydet</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function CustomerCard({ customer, calls, onClose, onCall }) {
  function formatDate(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
  function formatDur(s) {
    if (!s) return '—';
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-start justify-between">
          <div>
            <div className="text-base font-semibold text-slate-900">{customer.name} {customer.surname}</div>
            <div className="text-sm font-mono text-blue-600 mt-0.5">{customer.phone}</div>
            {customer.company && <div className="text-xs text-slate-500 mt-1">{customer.company}</div>}
            {customer.notes && <div className="text-xs text-slate-400 mt-1 italic">{customer.notes}</div>}
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => { onCall(customer.phone); onClose(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 rounded-lg text-sm text-white font-medium hover:bg-slate-800"
            >
              <Phone size={14} />
              Ara
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Geçmiş Aramalar ({calls.length})
          </div>
          {calls.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-10 border border-dashed border-slate-200 rounded-xl">
              Bu müşteriyle henüz arama yapılmamış
            </div>
          ) : (
            <div className="space-y-2">
              {calls.map(c => (
                <div key={c.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${
                    c.direction === 'inbound' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-violet-50 text-violet-700 border-violet-200'
                  }`}>
                    {c.direction === 'inbound' ? <><PhoneIncoming size={10} /> Gelen</> : <><PhoneOutgoing size={10} /> Giden</>}
                  </span>
                  <span className={`text-xs font-medium ${c.status === 'answered' ? 'text-emerald-600' : 'text-red-500'}`}>{c.status}</span>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">{formatDur(c.duration)}</span>
                  <span className="text-xs text-slate-400 ml-auto">{formatDate(c.started_at)}</span>
                  {c.agent_name && <span className="text-xs text-slate-400">{c.agent_name}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function Customers() {
  const { customers, total, search, loading, fetchCustomers, deleteCustomer, selectCustomer, selectedCustomer, customerCalls, clearSelected, toggleBlacklist } = useCustomerStore();
  const startCall = useCallStore(s => s.startCall);
  const agents = useAgentStore(s => s.agents);
  const [showCreate, setShowCreate] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [editing, setEditing] = useState(null);
  const [searchVal, setSearchVal] = useState('');

  useEffect(() => { fetchCustomers({ page: 1 }); }, []);

  const handleSearch = (v) => {
    setSearchVal(v);
    clearTimeout(window._cstimer);
    window._cstimer = setTimeout(() => fetchCustomers({ search: v, page: 1 }), 350);
  };

  const handleCall = async (phone) => {
    const agent = agents.find(a => a.status === 'available');
    await startCall({ customerPhone: phone, extensionNumber: agent?.extension || '101', agentId: agent?.id });
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchVal}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Ad, telefon veya şirket ara..."
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100 placeholder:text-slate-400"
          />
        </div>
        <span className="text-xs text-slate-400">{total} müşteri</span>
        <button
          onClick={() => setShowCSV(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <Upload size={14} />
          CSV İçe Aktar
        </button>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 rounded-lg text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
        >
          <Plus size={15} />
          Müşteri Ekle
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-slate-500 bg-slate-50 border-b border-slate-200">
              {['Ad Soyad', 'Telefon', 'Şirket', 'E-posta', 'Notlar', 'İşlemler'].map(h => (
                <th key={h} className="px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <AnimatePresence>
              {customers.map(c => (
                <motion.tr
                  key={c.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`transition-colors group border-b border-slate-100 dark:border-slate-800 ${
                    c.is_blacklisted
                      ? 'bg-slate-900 text-slate-200 hover:bg-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-900/90'
                      : 'hover:bg-slate-50 text-slate-700 bg-white dark:bg-slate-900 dark:hover:bg-slate-850'
                  }`}
                >
                  <td className="px-5 py-3.5">
                    <button onClick={() => selectCustomer(c)} className="text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                      <div className={`text-sm font-semibold flex items-center gap-1.5 ${c.is_blacklisted ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {c.name} {c.surname}
                        {c.is_blacklisted && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase tracking-wide animate-pulse">
                            Kara Liste
                          </span>
                        )}
                      </div>
                    </button>
                  </td>
                  <td className={`px-5 py-3.5 font-mono text-sm ${c.is_blacklisted ? 'text-rose-300' : 'text-slate-600 dark:text-slate-400'}`}>{c.phone}</td>
                  <td className={`px-5 py-3.5 text-sm ${c.is_blacklisted ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>{c.company || '—'}</td>
                  <td className={`px-5 py-3.5 text-sm ${c.is_blacklisted ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>{c.email || '—'}</td>
                  <td className={`px-5 py-3.5 text-sm max-w-xs truncate ${c.is_blacklisted ? 'text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>{c.notes || '—'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCall(c.phone)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 border border-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 dark:bg-slate-800 dark:border-slate-800 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Phone size={11} />
                        Ara
                      </button>
                      <button
                        onClick={() => toggleBlacklist(c.id, c.phone, !c.is_blacklisted)}
                        title={c.is_blacklisted ? 'Kara Listeden Çıkar' : 'Kara Listeye Ekle'}
                        className={`p-1.5 border rounded-lg transition-colors ${
                          c.is_blacklisted
                            ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-rose-950/20'
                        }`}
                      >
                        <ShieldAlert size={13} />
                      </button>
                      <button
                        onClick={() => setEditing(c)}
                        className="p-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 hover:text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => deleteCustomer(c.id)}
                        className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-red-950/30 dark:hover:border-red-900 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center">
                  <Users size={32} className="mx-auto text-slate-300 mb-3" />
                  <div className="text-sm text-slate-500 font-medium">
                    {search ? 'Arama sonucu bulunamadı' : 'Henüz müşteri eklenmemiş'}
                  </div>
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">Yükleniyor...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && <CustomerModal onClose={() => setShowCreate(false)} />}
      {editing && <CustomerModal customer={editing} onClose={() => setEditing(null)} />}
      {showCSV && <CSVImport onClose={() => setShowCSV(false)} />}
      {selectedCustomer && (
        <CustomerCard
          customer={selectedCustomer}
          calls={customerCalls}
          onClose={clearSelected}
          onCall={handleCall}
        />
      )}
    </div>
  );
}
