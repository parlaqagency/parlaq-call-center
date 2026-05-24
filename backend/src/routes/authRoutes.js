const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/queries');
const { authMiddleware } = require('../middleware/auth');

function signToken(agent) {
  return jwt.sign(
    { id: agent.id, name: agent.name, extension: agent.extension, role: agent.role, queue: agent.queue },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
}

function agentPayload(agent) {
  return { id: agent.id, name: agent.name, email: agent.email, extension: agent.extension, role: agent.role, queue: agent.queue, status: agent.status, break_reason: agent.break_reason || null, sip_password: agent.sip_password || null };
}

// Çalışan girişi — dahili numara + şifre
router.post('/login', async (req, res) => {
  try {
    const { extension, password } = req.body;
    if (!extension || !password) return res.status(400).json({ error: 'Dahili numara ve şifre gerekli' });

    const result = await pool.query('SELECT * FROM agents WHERE extension = $1', [extension]);
    const agent = result.rows[0];
    if (!agent) return res.status(401).json({ error: 'Dahili numara bulunamadı' });
    if (!agent.password_hash) return res.status(401).json({ error: 'Şifre henüz ayarlanmamış, admin ile iletişime geçin' });

    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) return res.status(401).json({ error: 'Hatalı şifre' });

    res.json({ token: signToken(agent), agent: agentPayload(agent) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin girişi — email + şifre
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre gerekli' });

    const result = await pool.query("SELECT * FROM agents WHERE email = $1 AND role = 'admin'", [email.toLowerCase().trim()]);
    const agent = result.rows[0];
    if (!agent) return res.status(401).json({ error: 'Admin hesabı bulunamadı' });
    if (!agent.password_hash) return res.status(401).json({ error: 'Şifre ayarlanmamış' });

    const valid = await bcrypt.compare(password, agent.password_hash);
    if (!valid) return res.status(401).json({ error: 'Hatalı şifre' });

    res.json({ token: signToken(agent), agent: agentPayload(agent) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, extension, phone, email, role, status, break_reason, queue, sip_password FROM agents WHERE id = $1', [req.user.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Şifre set et (admin başkasını, çalışan kendini)
router.post('/set-password', authMiddleware, async (req, res) => {
  try {
    const { agentId, password, role } = req.body;
    const targetId = agentId || req.user.id;

    if (targetId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetki yok' });
    }

    const hash = await bcrypt.hash(password, 10);
    const updates = ['password_hash = $1'];
    const params = [hash];
    if (role && req.user.role === 'admin') { updates.push(`role = $${params.length + 1}`); params.push(role); }
    params.push(targetId);

    await pool.query(`UPDATE agents SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// İlk kurulum — admin oluştur (email + ad + şifre)
router.post('/setup-admin', async (req, res) => {
  try {
    const existing = await pool.query("SELECT id FROM agents WHERE role = 'admin' LIMIT 1");
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Admin zaten mevcut' });

    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre gerekli' });

    const hash = await bcrypt.hash(password, 10);
    const extension = `adm_${Date.now()}`;
    const adminName = name || email.split('@')[0];
    const result = await pool.query(
      "INSERT INTO agents (name, email, extension, password_hash, role, status) VALUES ($1, $2, $3, $4, 'admin', 'available') RETURNING id, name, email, role",
      [adminName, email.toLowerCase().trim(), extension, hash]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
