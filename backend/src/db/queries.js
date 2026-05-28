const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[DB] Idle client error (ignored):', err.message);
});

const agents = {
  getAll: () => pool.query('SELECT * FROM agents ORDER BY name'),
  getById: (id) => pool.query('SELECT * FROM agents WHERE id = $1', [id]),
  create: ({ name, extension, phone, email, queue }) =>
    pool.query(
      'INSERT INTO agents (name, extension, phone, email, queue) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, extension, phone, email, queue]
    ),
  update: (id, fields) => {
    const keys = Object.keys(fields);
    const values = Object.values(fields);
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    return pool.query(`UPDATE agents SET ${set} WHERE id = $${keys.length + 1} RETURNING *`, [...values, id]);
  },
  delete: (id) => pool.query('DELETE FROM agents WHERE id = $1', [id]),
  updateStatus: (id, status, breakReason = null) =>
    pool.query('UPDATE agents SET status = $1, break_reason = $2 WHERE id = $3 RETURNING *', [status, breakReason, id]),
};

const calls = {
  create: ({ unique_id, agent_id, customer_id, customer_phone, direction }) =>
    pool.query(
      'INSERT INTO call_logs (unique_id, agent_id, customer_id, customer_phone, direction, status, started_at) VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *',
      [unique_id, agent_id, customer_id, customer_phone, direction, 'ringing']
    ),
  update: (unique_id, fields) => {
    const keys = Object.keys(fields);
    const values = Object.values(fields);
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    return pool.query(`UPDATE call_logs SET ${set} WHERE unique_id = $${keys.length + 1} RETURNING *`, [...values, unique_id]);
  },
  getHistory: ({ limit = 50, offset = 0, agentId, phone, onlyRecordings } = {}) => {
    let where = 'WHERE 1=1';
    const params = [];
    if (agentId) { params.push(agentId); where += ` AND cl.agent_id = $${params.length}`; }
    if (phone) { params.push(`%${phone}%`); where += ` AND cl.customer_phone LIKE $${params.length}`; }
    if (onlyRecordings) { where += ` AND cl.status = 'answered'`; }
    params.push(limit, offset);
    return pool.query(
      `SELECT cl.*, a.name as agent_name, c.is_blacklisted 
       FROM call_logs cl 
       LEFT JOIN agents a ON cl.agent_id = a.id 
       LEFT JOIN customers c ON cl.customer_phone = c.phone
       ${where} 
       ORDER BY cl.created_at DESC 
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
  },
  getActive: () =>
    pool.query(
      "SELECT cl.*, a.name as agent_name FROM call_logs cl LEFT JOIN agents a ON cl.agent_id = a.id WHERE cl.status IN ('ringing','answered') ORDER BY cl.started_at DESC"
    ),
  getTodayStats: () =>
    pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'answered') as answered,
        COUNT(*) FILTER (WHERE status = 'missed') as missed,
        ROUND(AVG(duration) FILTER (WHERE duration IS NOT NULL)) as avg_duration
      FROM call_logs
      WHERE DATE(created_at) = CURRENT_DATE
    `),
};

const customers = {
  findByPhone: (phone) => pool.query('SELECT * FROM customers WHERE phone = $1', [phone]),
  upsert: ({ name, phone, company }) =>
    pool.query(
      'INSERT INTO customers (name, phone, company) VALUES ($1,$2,$3) ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name RETURNING *',
      [name || null, phone, company || null]
    ),
  getAll: ({ search = '', limit = 50, offset = 0 } = {}) => {
    if (search) {
      const q = `%${search}%`;
      return pool.query(
        `SELECT * FROM customers WHERE name ILIKE $1 OR surname ILIKE $1 OR phone ILIKE $1 OR company ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [q, limit, offset]
      );
    }
    return pool.query('SELECT * FROM customers ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
  },
  count: (search = '') => {
    if (search) {
      const q = `%${search}%`;
      return pool.query('SELECT COUNT(*) FROM customers WHERE name ILIKE $1 OR surname ILIKE $1 OR phone ILIKE $1 OR company ILIKE $1', [q]);
    }
    return pool.query('SELECT COUNT(*) FROM customers');
  },
  getById: (id) => pool.query('SELECT * FROM customers WHERE id = $1', [id]),
  create: ({ name, surname, phone, email, company, notes }) =>
    pool.query(
      'INSERT INTO customers (name, surname, phone, email, company, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name || null, surname || null, phone, email || null, company || null, notes || null]
    ),
  update: (id, { name, surname, phone, email, company, notes }) =>
    pool.query(
      'UPDATE customers SET name=$1, surname=$2, phone=$3, email=$4, company=$5, notes=$6 WHERE id=$7 RETURNING *',
      [name || null, surname || null, phone, email || null, company || null, notes || null, id]
    ),
  delete: (id) => pool.query('DELETE FROM customers WHERE id = $1', [id]),
  bulkUpsert: (rows) => {
    if (!rows.length) return Promise.resolve({ rows: [] });
    const values = rows.map((_, i) => `($${i * 6 + 1},$${i * 6 + 2},$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6})`).join(',');
    const params = rows.flatMap(r => [r.name || null, r.surname || null, r.phone, r.company || null, r.email || null, r.notes || null]);
    return pool.query(
      `INSERT INTO customers (name, surname, phone, company, email, notes) VALUES ${values} ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, surname=EXCLUDED.surname, company=EXCLUDED.company RETURNING *`,
      params
    );
  },
  getCalls: (id) =>
    pool.query(
      `SELECT cl.*, a.name as agent_name FROM call_logs cl LEFT JOIN agents a ON cl.agent_id = a.id WHERE cl.customer_id = $1 ORDER BY cl.created_at DESC LIMIT 50`,
      [id]
    ),
};

module.exports = { pool, agents, calls, customers };
