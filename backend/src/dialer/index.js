const { pool } = require('../db/queries');
const netgsm    = require('../api/netgsm');

let io       = null;
let timer    = null;
let ticking  = false;
const TICK_MS = 4000;  // her 4 saniyede kontrol
const STUCK_MIN = 6;   // 6 dakika sonra stuck çağrıları sıfırla

// ── Yardımcılar ──────────────────────────────────────────────────
async function getRunningCampaign() {
  const r = await pool.query("SELECT * FROM call_campaigns WHERE status = 'running' ORDER BY started_at DESC LIMIT 1");
  return r.rows[0] || null;
}

async function getFreeAgents() {
  const r = await pool.query(
    "SELECT * FROM agents WHERE status = 'available' AND role = 'agent' AND extension NOT LIKE 'adm_%' ORDER BY extension"
  );
  return r.rows;
}

async function getNextContacts(campaignId, count) {
  const r = await pool.query(
    "SELECT * FROM campaign_contacts WHERE campaign_id = $1 AND status = 'pending' ORDER BY id ASC LIMIT $2",
    [campaignId, count]
  );
  return r.rows;
}

async function resetStuckCalls() {
  await pool.query(
    `UPDATE campaign_contacts
     SET status = 'pending', extension_used = NULL
     WHERE status = 'calling'
       AND called_at < NOW() - INTERVAL '${STUCK_MIN} minutes'`
  );
}

async function checkCampaignComplete(campaignId) {
  const r = await pool.query(
    "SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1 AND status IN ('pending','calling')",
    [campaignId]
  );
  if (parseInt(r.rows[0].count) === 0) {
    await pool.query(
      "UPDATE call_campaigns SET status = 'completed', completed_at = NOW() WHERE id = $1",
      [campaignId]
    );
    if (io) io.emit('campaign_completed', { campaignId });
    console.log(`Kampanya ${campaignId} tamamlandı`);
    return true;
  }
  return false;
}

async function emitStats(campaignId) {
  const r = await pool.query(
    `SELECT
       total_contacts, called_count, answered_count,
       (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1 AND status = 'pending')  AS pending,
       (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1 AND status = 'calling')  AS calling,
       (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1 AND status = 'answered') AS answered,
       (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1 AND status = 'missed')   AS missed,
       (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1 AND status = 'failed')   AS failed
     FROM call_campaigns WHERE id = $1`,
    [campaignId]
  );
  if (io && r.rows[0]) io.emit('campaign_stats', { campaignId, ...r.rows[0] });
}

// ── Ana tick ─────────────────────────────────────────────────────
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    await resetStuckCalls();

    const campaign = await getRunningCampaign();
    if (!campaign) return;

    const completed = await checkCampaignComplete(campaign.id);
    if (completed) return;

    const freeAgents = await getFreeAgents();
    if (freeAgents.length === 0) return;

    const contacts = await getNextContacts(campaign.id, freeAgents.length);
    if (contacts.length === 0) return;

    const pairs = Math.min(freeAgents.length, contacts.length);

    for (let i = 0; i < pairs; i++) {
      const agent   = freeAgents[i];
      const contact = contacts[i];

      try {
        // Atomik: sadece 'pending' olanı al (race condition önlemi)
        const locked = await pool.query(
          "UPDATE campaign_contacts SET status = 'calling', called_at = NOW(), extension_used = $1, attempt_count = attempt_count + 1 WHERE id = $2 AND status = 'pending' RETURNING id",
          [agent.extension, contact.id]
        );
        if (!locked.rows[0]) continue; // başkası aldı

        // Ajanı meşgul işaretle
        await pool.query("UPDATE agents SET status = 'busy' WHERE id = $1", [agent.id]);
        if (io) io.emit('agent_status_changed', {
          agentId: agent.id,
          status: 'busy',
          break_reason: null,
          callPhone: contact.phone,
          callStartedAt: new Date().toISOString(),
        });

        // Netgsm API çağrısı
        const crmId = `camp${campaign.id}_c${contact.id}_${Date.now()}`;
        await netgsm.startOutboundCall({
          customerPhone:   contact.phone,
          extensionNumber: agent.extension,
          crmId,
        });

        // CDR kaydı
        const cust = await pool.query(
          "INSERT INTO customers (phone, name) VALUES ($1, $2) ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, customers.name) RETURNING id",
          [contact.phone, contact.name || null]
        );
        const logRow = await pool.query(
          "INSERT INTO call_logs (unique_id, agent_id, customer_id, customer_phone, direction, status, started_at) VALUES ($1,$2,$3,$4,'outbound','ringing',NOW()) RETURNING id",
          [crmId, agent.id, cust.rows[0].id, contact.phone]
        );

        await pool.query(
          "UPDATE campaign_contacts SET call_log_id = $1 WHERE id = $2",
          [logRow.rows[0].id, contact.id]
        );
        await pool.query(
          "UPDATE call_campaigns SET called_count = called_count + 1 WHERE id = $1",
          [campaign.id]
        );

        console.log(`[Dialer] ${contact.phone} → dahili ${agent.extension}`);
        if (io) io.emit('campaign_call_started', {
          campaignId: campaign.id,
          phone: contact.phone,
          extension: agent.extension,
          contactId: contact.id,
        });

      } catch (err) {
        console.error(`[Dialer] ${contact.phone} hatası:`, err.message);
        await pool.query(
          "UPDATE campaign_contacts SET status = 'failed' WHERE id = $1",
          [contact.id]
        );
        await pool.query("UPDATE agents SET status = 'available' WHERE id = $1", [agent.id]);
        if (io) io.emit('agent_status_changed', { agentId: agent.id, status: 'available', break_reason: null });
      }
    }

    await emitStats(campaign.id);
  } catch (err) {
    console.error('[Dialer] tick hatası:', err.message);
  } finally {
    ticking = false;
  }
}

// Netgsm webhook ile entegrasyon — dışarıdan çağrılır
async function onCallEnd(uniqueId, disposition) {
  try {
    const r = await pool.query(
      `SELECT cc.*, cl.campaign_id AS cid, cl.agent_id AS aid
       FROM campaign_contacts cc
       JOIN call_logs cl ON cc.call_log_id = cl.id
       WHERE cl.unique_id = $1`,
      [uniqueId]
    );
    if (!r.rows[0]) return;

    const contact = r.rows[0];
    const newStatus = (disposition === 'ANSWERED' || disposition === 'answered') ? 'answered' : 'missed';
    await pool.query("UPDATE campaign_contacts SET status = $1 WHERE id = $2", [newStatus, contact.id]);

    if (newStatus === 'answered') {
      await pool.query(
        "UPDATE call_campaigns SET answered_count = answered_count + 1 WHERE id = $1",
        [contact.campaign_id]
      );
    }

    // Agent'ı available'a döndür (sadece dialer'ın busy yaptığı agent'lar için)
    if (contact.aid) {
      await pool.query(
        "UPDATE agents SET status = 'available' WHERE id = $1 AND status = 'busy'",
        [contact.aid]
      );
      if (io) io.emit('agent_status_changed', { agentId: contact.aid, status: 'available', break_reason: null });
    }

    if (io) io.emit('campaign_call_ended', { contactId: contact.id, status: newStatus, campaignId: contact.campaign_id });
    await emitStats(contact.campaign_id);
  } catch {}
}

function start(socketIo) {
  if (timer) return;
  io = socketIo;
  timer = setInterval(tick, TICK_MS);
  console.log('[Dialer] başlatıldı');
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { start, stop, onCallEnd };
