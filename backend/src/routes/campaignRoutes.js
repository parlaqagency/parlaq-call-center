const router = require('express').Router();
const { pool } = require('../db/queries');

function isUKNumber(phone) {
  if (!phone) return false;
  const clean = String(phone).replace(/[^\d+]/g, '');
  return clean.startsWith('+44') || clean.startsWith('44') || clean.startsWith('0044');
}

pool.query(`ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS assigned_extension VARCHAR(20)`)
  .then(() => pool.query(`ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS disposition VARCHAR(50)`))
  .then(() => pool.query(`ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS notes TEXT`))
  .then(() => pool.query(`CREATE INDEX IF NOT EXISTS idx_cc_ext ON campaign_contacts(assigned_extension) WHERE assigned_extension IS NOT NULL`))
  .catch(err => console.error('[Campaign] Migration:', err.message));

module.exports = function campaignRoutes(io) {

  // Liste
  router.get('/', async (req, res) => {
    try {
      const r = await pool.query(
        `SELECT c.*, a.name as created_by_name,
           (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = c.id AND status = 'pending')  AS pending,
           (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = c.id AND status = 'calling')  AS calling,
           (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = c.id AND status = 'answered') AS answered_contacts,
           (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = c.id AND status = 'missed')   AS missed,
           (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = c.id AND status = 'failed')   AS failed
         FROM call_campaigns c
         LEFT JOIN agents a ON c.created_by = a.id
         ORDER BY c.created_at DESC`
      );
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Agent's personal queue
  router.get('/my-queue', async (req, res) => {
    try {
      const { extension } = req.user;
      const [leads, stats] = await Promise.all([
        pool.query(
          `SELECT cc.id, cc.campaign_id, cc.phone, cc.name, cc.status, cc.disposition, cc.notes, cc.created_at,
                  c.is_blacklisted AS is_blacklisted
           FROM campaign_contacts cc
           LEFT JOIN customers c ON cc.phone = c.phone
           WHERE cc.assigned_extension = $1
           ORDER BY cc.id ASC`,
          [extension]
        ),
        pool.query(
          `SELECT
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE status NOT IN ('pending','calling')) AS completed
           FROM campaign_contacts
           WHERE assigned_extension = $1`,
          [extension]
        ),
      ]);
      res.json({ leads: leads.rows, stats: stats.rows[0] });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Tek kampanya + kişi listesi
  router.get('/:id/contacts', async (req, res) => {
    try {
      const r = await pool.query(
        'SELECT * FROM campaign_contacts WHERE campaign_id = $1 ORDER BY id ASC',
        [req.params.id]
      );
      res.json(r.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Oluştur
  router.post('/', async (req, res) => {
    try {
      const { name, contacts, notes } = req.body;
      if (!name || !contacts?.length) return res.status(400).json({ error: 'İsim ve kişi listesi zorunlu' });

      // Filter out UK numbers
      const filteredContacts = contacts.filter(c => !isUKNumber(c.phone));
      if (!filteredContacts.length) {
        return res.status(400).json({ error: 'Sisteme UK numaraları yüklenemez. Kampanyada geçerli numara kalmadı.' });
      }

      const camp = await pool.query(
        'INSERT INTO call_campaigns (name, notes, created_by, total_contacts) VALUES ($1,$2,$3,$4) RETURNING *',
        [name, notes || null, req.user.id, filteredContacts.length]
      );
      const campaignId = camp.rows[0].id;

      // Get system agent extensions dynamically for round-robin assignment
      const agentsResult = await pool.query("SELECT extension FROM agents WHERE role = 'agent' ORDER BY id ASC");
      const extensions = agentsResult.rows.length > 0 
        ? agentsResult.rows.map(a => a.extension) 
        : ['101', '102', '103', '104', '105'];

      const vals   = filteredContacts.map((_, i) => `($1, $${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`).join(',');
      const params = [campaignId, ...filteredContacts.flatMap((c, i) => [
        c.phone, 
        c.name || null, 
        c.assigned_extension || extensions[i % extensions.length]
      ])];
      await pool.query(
        `INSERT INTO campaign_contacts (campaign_id, phone, name, assigned_extension) VALUES ${vals}`,
        params
      );

      res.status(201).json(camp.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Update lead outcome
  router.patch('/contacts/:id/outcome', async (req, res) => {
    try {
      const { disposition, notes } = req.body;
      const { extension, role } = req.user;

      if (role !== 'admin') {
        const own = await pool.query(
          'SELECT id FROM campaign_contacts WHERE id = $1 AND assigned_extension = $2',
          [req.params.id, extension]
        );
        if (!own.rows[0]) return res.status(403).json({ error: 'Bu lead size ait değil' });
      }

      const DISP_STATUS = {
        answered: 'answered', not_interested: 'answered', appointment: 'answered',
        callback: 'pending',
        missed: 'missed', busy: 'missed',
        wrong_number: 'failed',
      };
      const newStatus = DISP_STATUS[disposition] ?? 'missed';

      const r = await pool.query(
        `UPDATE campaign_contacts SET disposition=$1, status=$2, notes=COALESCE($3, notes) WHERE id=$4 RETURNING *`,
        [disposition, newStatus, notes || null, req.params.id]
      );

      if (io) io.emit('queue_updated', { extension: r.rows[0]?.assigned_extension, contactId: +req.params.id });
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Admin: lead atama (tek tek veya toplu)
  router.post('/:id/assign', async (req, res) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Yetkisiz' });

      const { assignments, distribution, extensions } = req.body;

      if (assignments?.length) {
        for (const { contactId, extension } of assignments) {
          await pool.query(
            `UPDATE campaign_contacts SET assigned_extension=$1, status='pending' WHERE id=$2 AND campaign_id=$3`,
            [extension, contactId, req.params.id]
          );
        }
        const affected = [...new Set(assignments.map(a => a.extension))];
        affected.forEach(ext => io?.emit('queue_updated', { extension: ext, action: 'assigned' }));
      } else if (distribution === 'even' && extensions?.length) {
        const pending = await pool.query(
          `SELECT id FROM campaign_contacts WHERE campaign_id=$1 AND (assigned_extension IS NULL OR assigned_extension='') ORDER BY id ASC`,
          [req.params.id]
        );
        for (let i = 0; i < pending.rows.length; i++) {
          const ext = extensions[i % extensions.length];
          await pool.query(
            `UPDATE campaign_contacts SET assigned_extension=$1, status='pending' WHERE id=$2`,
            [ext, pending.rows[i].id]
          );
        }
        extensions.forEach(ext => io?.emit('queue_updated', { extension: ext, action: 'assigned' }));
      }

      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Başlat
  router.post('/:id/start', async (req, res) => {
    try {
      const r = await pool.query(
        "UPDATE call_campaigns SET status='running', started_at=COALESCE(started_at,NOW()) WHERE id=$1 AND status IN ('pending','paused') RETURNING *",
        [req.params.id]
      );
      if (!r.rows[0]) return res.status(400).json({ error: 'Kampanya başlatılamadı' });
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Duraklat
  router.post('/:id/pause', async (req, res) => {
    try {
      const r = await pool.query(
        "UPDATE call_campaigns SET status='paused' WHERE id=$1 AND status='running' RETURNING *",
        [req.params.id]
      );
      if (!r.rows[0]) return res.status(400).json({ error: 'Kampanya duraklatilamadı' });
      res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Durdur
  router.post('/:id/stop', async (req, res) => {
    try {
      await pool.query("UPDATE call_campaigns SET status='stopped', completed_at=NOW() WHERE id=$1", [req.params.id]);
      await pool.query("UPDATE campaign_contacts SET status='missed' WHERE campaign_id=$1 AND status='calling'", [req.params.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Sil
  router.delete('/:id', async (req, res) => {
    try {
      await pool.query('DELETE FROM call_campaigns WHERE id=$1', [req.params.id]);
      res.sendStatus(204);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return router;
};
