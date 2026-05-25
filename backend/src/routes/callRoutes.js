const router = require('express').Router();
const netgsm = require('../api/netgsm');
const { calls, customers, agents } = require('../db/queries');

router.post('/start', async (req, res) => {
  try {
    const { customerPhone, extensionNumber, agentId, customerName } = req.body;
    if (!customerPhone || !extensionNumber) return res.status(400).json({ error: 'customerPhone ve extensionNumber gerekli' });

    const crmId = `call_${Date.now()}`;
    const result = await netgsm.startOutboundCall({ customerPhone, extensionNumber, crmId });

    const [customerRow] = (await customers.upsert({ phone: customerPhone, name: customerName })).rows;
    const callRow = (await calls.create({
      unique_id: result.unique_id || crmId,
      agent_id: agentId || null,
      customer_id: customerRow.id,
      customer_phone: customerPhone,
      direction: 'outbound',
    })).rows[0];

    if (agentId) await agents.updateStatus(agentId, 'busy');

    res.json({ ...callRow, netgsm: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/hangup', async (req, res) => {
  try {
    const { uniqueId, crmId, agentId, duration } = req.body;
    const result = await netgsm.hangupCall({ uniqueId, crmId });

    await calls.update(uniqueId, {
      status: 'answered',
      duration: duration || 0,
      ended_at: new Date(),
    });

    if (agentId) await agents.updateStatus(agentId, 'available');

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/mute', async (req, res) => {
  try {
    const { uniqueId, crmId, direction, state } = req.body;
    const result = await netgsm.muteCall({ uniqueId, crmId, direction, state });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/transfer', async (req, res) => {
  try {
    const { uniqueId, crmId, extension } = req.body;
    const result = await netgsm.transferCall({ uniqueId, crmId, extension });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { limit, offset, agentId, phone } = req.query;
    const result = await calls.getHistory({ limit, offset, agentId, phone });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/active', async (req, res) => {
  try {
    const result = await calls.getActive();
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/today-stats', async (req, res) => {
  try {
    const result = await calls.getTodayStats();
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Çalışanın kendi bugünkü istatistikleri
router.get('/my-stats', async (req, res) => {
  try {
    const { pool } = require('../db/queries');
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'answered')::int AS answered,
        COUNT(*) FILTER (WHERE status = 'missed')::int AS missed,
        ROUND(AVG(duration) FILTER (WHERE duration > 0))::int AS avg_duration,
        COALESCE(SUM(duration) FILTER (WHERE duration > 0), 0)::int AS talk_seconds
      FROM call_logs
      WHERE agent_id = $1 AND DATE(created_at) = CURRENT_DATE
    `, [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Çalışanın saatlik çağrı dağılımı (sparkline için)
router.get('/my-hourly', async (req, res) => {
  try {
    const { pool } = require('../db/queries');
    const result = await pool.query(`
      SELECT EXTRACT(HOUR FROM started_at)::int AS hour, COUNT(*)::int AS count
      FROM call_logs
      WHERE agent_id = $1
        AND DATE(started_at) = CURRENT_DATE
        AND status = 'answered'
      GROUP BY hour ORDER BY hour
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Telefona göre çağrı geçmişi
router.get('/by-phone/:phone', async (req, res) => {
  try {
    const { pool } = require('../db/queries');
    const result = await pool.query(
      `SELECT cl.*, a.name AS agent_name
       FROM call_logs cl
       LEFT JOIN agents a ON cl.agent_id = a.id
       WHERE cl.customer_phone = $1
       ORDER BY cl.created_at DESC LIMIT 10`,
      [req.params.phone]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sonuç / Disposition kaydet
router.patch('/:id/disposition', async (req, res) => {
  try {
    const { disposition, notes, callback_at } = req.body;
    const { pool } = require('../db/queries');

    const r = await pool.query(
      `UPDATE call_logs
       SET disposition = COALESCE($1, disposition),
           notes = COALESCE($2, notes),
           callback_at = COALESCE($3, callback_at),
           status = CASE WHEN status = 'ringing' THEN 'missed' ELSE status END
       WHERE id = $4 RETURNING *`,
      [disposition || null, notes || null, callback_at || null, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Çağrı bulunamadı' });

    // Campaign contact durumunu güncelle
    const log = r.rows[0];
    const cc = await pool.query('SELECT * FROM campaign_contacts WHERE call_log_id = $1', [log.id]);
    if (cc.rows[0]) {
      const ccStatus = disposition === 'callback' ? 'pending'
        : disposition === 'not_interested' ? 'answered'
        : cc.rows[0].status;
      await pool.query('UPDATE campaign_contacts SET status = $1 WHERE id = $2', [ccStatus, cc.rows[0].id]);

      // Callback ise appointment oluştur
      if (disposition === 'callback' && callback_at) {
        await pool.query(
          `INSERT INTO appointments (agent_id, customer_phone, customer_name, title, scheduled_at)
           VALUES ($1, $2, $3, 'Geri Arama', $4)
           ON CONFLICT DO NOTHING`,
          [log.agent_id, log.customer_phone, null, callback_at]
        );
      }
    }

    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// JsSIP tarafından başlatılan çağrıyı CDR'a kaydet (Netgsm API çağrılmaz)
router.post('/log', async (req, res) => {
  try {
    const { customerPhone, direction = 'outbound' } = req.body;
    if (!customerPhone) return res.status(400).json({ error: 'customerPhone zorunlu' });
    const crmId = `sip_${Date.now()}`;
    const [customerRow] = (await customers.upsert({ phone: customerPhone, name: null })).rows;
    const callRow = (await calls.create({
      unique_id: crmId,
      agent_id: req.user.id,
      customer_id: customerRow.id,
      customer_phone: customerPhone,
      direction,
    })).rows[0];
    res.json(callRow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Çağrıyı tamamla (JsSIP ended/failed olayı)
router.patch('/:id/complete', async (req, res) => {
  try {
    const { duration = 0, status = 'answered' } = req.body;
    const { pool } = require('../db/queries');
    const r = await pool.query(
      'UPDATE call_logs SET status = $1, duration = $2, ended_at = NOW() WHERE id = $3 RETURNING *',
      [status, duration, req.params.id]
    );
    res.json(r.rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Çalışanın bugünkü çağrı geçmişi
router.get('/my-history', async (req, res) => {
  try {
    const { pool } = require('../db/queries');
    const result = await pool.query(
      `SELECT cl.*, a.name as agent_name
       FROM call_logs cl
       LEFT JOIN agents a ON cl.agent_id = a.id
       WHERE cl.agent_id = $1 AND DATE(cl.created_at) = CURRENT_DATE
       ORDER BY cl.created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Çalışanın bekleyen geri aramaları
router.get('/callbacks', async (req, res) => {
  try {
    const { pool } = require('../db/queries');
    const r = await pool.query(
      `SELECT cl.*, c.name AS customer_name, c.surname AS customer_surname
       FROM call_logs cl
       LEFT JOIN customers c ON cl.customer_id = c.id
       WHERE cl.disposition = 'callback' AND cl.callback_at IS NOT NULL
         AND cl.agent_id = $1
       ORDER BY cl.callback_at ASC LIMIT 20`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Arama ses kaydını getir ve cache'le
router.get('/:id/recording', async (req, res) => {
  try {
    const { pool } = require('../db/queries');
    const recordingService = require('../api/recordingService');

    // 1. Çağrıyı getir
    const r = await pool.query('SELECT * FROM call_logs WHERE id = $1', [req.params.id]);
    const call = r.rows[0];
    if (!call) return res.status(404).json({ error: 'Çağrı bulunamadı' });

    // 2. Eğer kayıt URL'si zaten varsa doğrudan döndür
    if (call.recording_url) {
      return res.json({ recording_url: call.recording_url });
    }

    // 3. Çağrı cevaplanmadıysa ses kaydı olmaz
    if (call.status !== 'answered' && (call.duration || 0) === 0) {
      return res.status(400).json({ error: 'Cevaplanmamış aramaların ses kaydı bulunmaz' });
    }

    // 4. Netgsm'den dinamik olarak sorgula
    const recordingUrl = await recordingService.fetchRecordingUrl(call);
    if (!recordingUrl) {
      return res.status(404).json({ error: 'Ses kaydı Netgsm üzerinde henüz bulunamadı veya santralde ses kaydı aktif değil' });
    }

    // 5. Veritabanına kaydet (cache)
    await pool.query('UPDATE call_logs SET recording_url = $1 WHERE id = $2', [recordingUrl, call.id]);

    res.json({ recording_url: recordingUrl });
  } catch (err) {
    console.error('[callRoutes] Recording error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
