const router = require('express').Router();
const { customers } = require('../db/queries');

function isUKNumber(phone) {
  if (!phone) return false;
  const clean = String(phone).replace(/[^\d+]/g, '');
  return clean.startsWith('+44') || clean.startsWith('44') || clean.startsWith('0044');
}

router.get('/', async (req, res) => {
  try {
    const { search = '', page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const [rows, countResult] = await Promise.all([
      customers.getAll({ search, limit: parseInt(limit), offset: parseInt(offset) }),
      customers.count(search),
    ]);
    res.json({ data: rows.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await customers.getById(req.params.id);
    if (!result.rows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/calls', async (req, res) => {
  try {
    const result = await customers.getCalls(req.params.id);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (req.body.phone && isUKNumber(req.body.phone)) {
      return res.status(400).json({ error: 'UK numaraları bu sisteme kaydedilemez' });
    }
    const result = await customers.create(req.body);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Bu telefon numarası zaten kayıtlı' });
    res.status(500).json({ error: err.message });
  }
});

router.post('/bulk', async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'Geçersiz veri' });
    const filteredRows = rows.filter(r => !isUKNumber(r.phone));
    const result = await customers.bulkUpsert(filteredRows);
    res.json({ imported: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (req.body.phone && isUKNumber(req.body.phone)) {
      return res.status(400).json({ error: 'UK numaraları bu sisteme kaydedilemez' });
    }
    const result = await customers.update(req.params.id, req.body);
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Bu telefon numarası zaten kayıtlı' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await customers.delete(req.params.id);
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
