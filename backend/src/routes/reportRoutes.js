const router = require('express').Router();
const netgsm = require('../api/netgsm');
const { calls } = require('../db/queries');
const { pool } = require('../db/queries');

router.get('/cdr', async (req, res) => {
  try {
    const { startDate, stopDate, phone } = req.query;
    if (startDate && stopDate) {
      const result = await netgsm.getCDR({ startDate, stopDate, phone });
      return res.json(result);
    }
    const result = await calls.getHistory({ limit: 100 });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cdr/export', async (req, res) => {
  try {
    const { phone } = req.query;
    const result = await calls.getHistory({ limit: 1000, phone });
    const rows = result.rows;
    const header = 'ID,Telefon,Yön,Durum,Süre(sn),Çalışan,Başlangıç\n';
    const csv = rows.map(r =>
      [r.id, r.customer_phone, r.direction, r.status, r.duration || 0, r.agent_name || '', r.started_at ? new Date(r.started_at).toLocaleString('tr-TR') : ''].join(',')
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cdr-export.csv"');
    res.send('﻿' + header + csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const { startDate, stopDate } = req.query;
    if (startDate && stopDate) {
      const result = await netgsm.getCallStats({ startDate, stopDate });
      return res.json(result);
    }
    const result = await calls.getTodayStats();
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/weekly', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        TO_CHAR(DATE(created_at), 'Dy') as day,
        COUNT(*) FILTER (WHERE direction = 'inbound') as gelen,
        COUNT(*) FILTER (WHERE direction = 'outbound') as giden,
        COUNT(*) FILTER (WHERE status = 'missed') as cevapsiz
      FROM call_logs
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/agent/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE status = 'answered') as answered,
        COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
        COUNT(*) FILTER (WHERE direction = 'outbound') as outbound,
        ROUND(AVG(duration) FILTER (WHERE duration IS NOT NULL)) as avg_duration
      FROM call_logs
      WHERE agent_id = $1 AND DATE(created_at) = CURRENT_DATE
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Çağrıya not ekle
router.patch('/call/:id/notes', async (req, res) => {
  try {
    const { notes } = req.body;
    const result = await pool.query('UPDATE call_logs SET notes = $1 WHERE id = $2 RETURNING *', [notes, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Disposition dağılımı
router.get('/dispositions', async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    const where = period === 'week'
      ? "created_at >= NOW() - INTERVAL '7 days'"
      : "DATE(created_at) = CURRENT_DATE";
    const result = await pool.query(`
      SELECT disposition, COUNT(*)::int AS count
      FROM call_logs
      WHERE ${where} AND disposition IS NOT NULL
      GROUP BY disposition
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ajan performans sıralaması
router.get('/agent-performance', async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    const where = period === 'week'
      ? "cl.created_at >= NOW() - INTERVAL '7 days'"
      : "DATE(cl.created_at) = CURRENT_DATE";
    const result = await pool.query(`
      SELECT
        a.id, a.name, a.extension,
        COUNT(cl.id)::int AS total,
        COUNT(cl.id) FILTER (WHERE cl.status = 'answered')::int AS answered,
        COUNT(cl.id) FILTER (WHERE cl.direction = 'inbound')::int AS inbound,
        COUNT(cl.id) FILTER (WHERE cl.direction = 'outbound')::int AS outbound,
        COALESCE(ROUND(AVG(cl.duration) FILTER (WHERE cl.duration > 0))::int, 0) AS avg_duration,
        CASE WHEN COUNT(cl.id) > 0
          THEN ROUND(100.0 * COUNT(cl.id) FILTER (WHERE cl.status = 'answered') / COUNT(cl.id))::int
          ELSE 0 END AS answer_rate
      FROM agents a
      LEFT JOIN call_logs cl ON cl.agent_id = a.id AND ${where}
      WHERE a.role != 'admin'
      GROUP BY a.id, a.name, a.extension
      ORDER BY total DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
