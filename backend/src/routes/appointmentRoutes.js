const router = require('express').Router();
const { pool } = require('../db/queries');

// Tümünü listele (admin: hepsi, agent: kendi)
router.get('/', async (req, res) => {
  try {
    const { status, agentId, date } = req.query;
    const isAdmin = req.user.role === 'admin';
    const params = [];
    const where = ['1=1'];

    if (!isAdmin) {
      params.push(req.user.id);
      where.push(`a.agent_id = $${params.length}`);
    } else if (agentId) {
      params.push(agentId);
      where.push(`a.agent_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      where.push(`a.status = $${params.length}`);
    }

    if (date === 'today') {
      where.push(`DATE(a.scheduled_at) = CURRENT_DATE`);
    } else if (date === 'week') {
      where.push(`a.scheduled_at >= date_trunc('week', NOW()) AND a.scheduled_at < date_trunc('week', NOW()) + interval '7 days'`);
    } else if (date === 'upcoming') {
      where.push(`a.scheduled_at >= NOW()`);
    }

    const result = await pool.query(
      `SELECT a.*, ag.name as agent_name, ag.extension as agent_extension
       FROM appointments a
       LEFT JOIN agents ag ON a.agent_id = ag.id
       WHERE ${where.join(' AND ')}
       ORDER BY a.scheduled_at ASC
       LIMIT 200`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Oluştur
router.post('/', async (req, res) => {
  try {
    const { customer_phone, customer_name, customer_id, title, notes, scheduled_at } = req.body;
    if (!title || !scheduled_at) return res.status(400).json({ error: 'Başlık ve tarih/saat zorunlu' });

    const result = await pool.query(
      `INSERT INTO appointments (agent_id, customer_id, customer_phone, customer_name, title, notes, scheduled_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, customer_id || null, customer_phone || null, customer_name || null, title, notes || null, scheduled_at]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Durum güncelle
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Geçersiz durum' });
    }
    const result = await pool.query(
      'UPDATE appointments SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Randevu bulunamadı' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Güncelle
router.put('/:id', async (req, res) => {
  try {
    const { title, notes, scheduled_at, customer_phone, customer_name } = req.body;
    const result = await pool.query(
      `UPDATE appointments SET title=$1, notes=$2, scheduled_at=$3, customer_phone=$4, customer_name=$5
       WHERE id=$6 RETURNING *`,
      [title, notes || null, scheduled_at, customer_phone || null, customer_name || null, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sil
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM appointments WHERE id = $1', [req.params.id]);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
