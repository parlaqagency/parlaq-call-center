import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import axios from 'axios';

const BAR_COLORS = { gelen: '#3b82f6', giden: '#8b5cf6', cevapsiz: '#ef4444' };
const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs shadow-lg">
      <div className="text-slate-500 mb-1.5 font-medium">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="font-semibold text-slate-900">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function StatsChart() {
  const [weekly, setWeekly] = useState([]);
  const [pie, setPie] = useState([]);

  useEffect(() => {
    axios.get('/api/reports/weekly').then(r => {
      setWeekly(r.data || []);
    }).catch(() => {
      const days = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
      setWeekly(days.map(d => ({
        day: d,
        gelen: Math.floor(Math.random() * 30),
        giden: Math.floor(Math.random() * 20),
        cevapsiz: Math.floor(Math.random() * 8),
      })));
    });

    axios.get('/api/calls/today-stats').then(r => {
      const d = r.data;
      setPie([
        { name: 'Cevaplanan', value: parseInt(d.answered) || 0 },
        { name: 'Cevapsız', value: parseInt(d.missed) || 0 },
      ].filter(x => x.value > 0));
    }).catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-5">Haftalık Çağrı Dağılımı</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weekly} barGap={2} barCategoryGap="30%">
            <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#64748b', paddingTop: 8 }} />
            <Bar dataKey="gelen" name="Gelen" fill={BAR_COLORS.gelen} radius={[3, 3, 0, 0]} />
            <Bar dataKey="giden" name="Giden" fill={BAR_COLORS.giden} radius={[3, 3, 0, 0]} />
            <Bar dataKey="cevapsiz" name="Cevapsız" fill={BAR_COLORS.cevapsiz} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Bugün Sonuç</h3>
        {pie.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={pie} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} dataKey="value">
                  {pie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-3">
              {pie.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[i] }} />
                    <span className="text-xs text-slate-500">{p.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-900 tabular-nums">{p.value}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Bugün henüz çağrı yok
          </div>
        )}
      </div>
    </div>
  );
}
