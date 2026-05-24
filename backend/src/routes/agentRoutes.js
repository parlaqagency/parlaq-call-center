const router = require('express').Router();
const netgsm = require('../api/netgsm');
const { agents } = require('../db/queries');
const { pool } = require('../db/queries');

module.exports = (io) => {
  // ── Self-service routes (/me/*) — must come before /:id/* ─────────
  router.post('/me/login', async (req, res) => {
    try {
      const agent = (await agents.getById(req.user.id)).rows[0];
      if (!agent) return res.status(404).json({ error: 'Agent bulunamadı' });
      await netgsm.agentLogin({ extension: agent.extension, queue: agent.queue || 'satis', crmId: `login_${Date.now()}` }).catch(() => {});
      await agents.updateStatus(agent.id, 'available', null);
      io.emit('agent_status_changed', { agentId: agent.id, status: 'available', break_reason: null });
      res.json({ status: 'available', break_reason: null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/me/logoff', async (req, res) => {
    try {
      const agent = (await agents.getById(req.user.id)).rows[0];
      if (!agent) return res.status(404).json({ error: 'Agent bulunamadı' });
      await netgsm.agentLogoff({ extension: agent.extension, queue: agent.queue || 'satis', crmId: `logoff_${Date.now()}` }).catch(() => {});
      await agents.updateStatus(agent.id, 'offline', null);
      io.emit('agent_status_changed', { agentId: agent.id, status: 'offline', break_reason: null });
      res.json({ status: 'offline', break_reason: null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/me/pause', async (req, res) => {
    try {
      const agent = (await agents.getById(req.user.id)).rows[0];
      if (!agent) return res.status(404).json({ error: 'Agent bulunamadı' });
      const { reason = '' } = req.body;
      await netgsm.agentPause({ extension: agent.extension, queue: agent.queue || 'satis', crmId: `pause_${Date.now()}`, paused: 1, reason }).catch(() => {});
      await agents.updateStatus(agent.id, 'break', reason || null);
      await pool.query('INSERT INTO breaks (agent_id, reason) VALUES ($1, $2)', [agent.id, reason]).catch(() => {});
      io.emit('agent_status_changed', { agentId: agent.id, status: 'break', break_reason: reason || null });
      res.json({ status: 'break', break_reason: reason || null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/me/unpause', async (req, res) => {
    try {
      const agent = (await agents.getById(req.user.id)).rows[0];
      if (!agent) return res.status(404).json({ error: 'Agent bulunamadı' });
      await netgsm.agentPause({ extension: agent.extension, queue: agent.queue || 'satis', crmId: `unpause_${Date.now()}`, paused: 0 }).catch(() => {});
      await agents.updateStatus(agent.id, 'available', null);
      await pool.query("UPDATE breaks SET ended_at = NOW() WHERE agent_id = $1 AND ended_at IS NULL", [agent.id]).catch(() => {});
      io.emit('agent_status_changed', { agentId: agent.id, status: 'available', break_reason: null });
      res.json({ status: 'available', break_reason: null });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Admin routes (/:id/*) ─────────────────────────────────────────
  router.get('/', async (req, res) => {
    try {
      const result = await agents.getAll();
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const result = await agents.create(req.body);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const result = await agents.update(req.params.id, req.body);
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      await agents.delete(req.params.id);
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/login', async (req, res) => {
    try {
      const agent = (await agents.getById(req.params.id)).rows[0];
      if (!agent) return res.status(404).json({ error: 'Agent bulunamadı' });
      await netgsm.agentLogin({ extension: agent.extension, queue: agent.queue, crmId: `login_${Date.now()}` });
      await agents.updateStatus(agent.id, 'available', null);
      io.emit('agent_status_changed', { agentId: agent.id, status: 'available', break_reason: null });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/logoff', async (req, res) => {
    try {
      const agent = (await agents.getById(req.params.id)).rows[0];
      if (!agent) return res.status(404).json({ error: 'Agent bulunamadı' });
      await netgsm.agentLogoff({ extension: agent.extension, queue: agent.queue, crmId: `logoff_${Date.now()}` });
      await agents.updateStatus(agent.id, 'offline', null);
      io.emit('agent_status_changed', { agentId: agent.id, status: 'offline', break_reason: null });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/pause', async (req, res) => {
    try {
      const agent = (await agents.getById(req.params.id)).rows[0];
      if (!agent) return res.status(404).json({ error: 'Agent bulunamadı' });
      const { reason = '' } = req.body;
      await netgsm.agentPause({ extension: agent.extension, queue: agent.queue, crmId: `pause_${Date.now()}`, paused: 1, reason });
      await agents.updateStatus(agent.id, 'break', reason || null);
      await pool.query('INSERT INTO breaks (agent_id, reason) VALUES ($1, $2)', [agent.id, reason]).catch(() => {});
      io.emit('agent_status_changed', { agentId: agent.id, status: 'break', break_reason: reason || null });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/:id/unpause', async (req, res) => {
    try {
      const agent = (await agents.getById(req.params.id)).rows[0];
      if (!agent) return res.status(404).json({ error: 'Agent bulunamadı' });
      await netgsm.agentPause({ extension: agent.extension, queue: agent.queue, crmId: `unpause_${Date.now()}`, paused: 0 });
      await agents.updateStatus(agent.id, 'available', null);
      await pool.query("UPDATE breaks SET ended_at = NOW() WHERE agent_id = $1 AND ended_at IS NULL", [agent.id]).catch(() => {});
      io.emit('agent_status_changed', { agentId: agent.id, status: 'available', break_reason: null });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
