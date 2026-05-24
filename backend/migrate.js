require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('Migration başlatılıyor...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS call_campaigns (
      id             SERIAL PRIMARY KEY,
      name           VARCHAR(200) NOT NULL,
      status         VARCHAR(20)  DEFAULT 'pending',
      total_contacts INTEGER      DEFAULT 0,
      called_count   INTEGER      DEFAULT 0,
      answered_count INTEGER      DEFAULT 0,
      created_by     INTEGER REFERENCES agents(id) ON DELETE SET NULL,
      notes          TEXT,
      created_at     TIMESTAMP DEFAULT NOW(),
      started_at     TIMESTAMP,
      completed_at   TIMESTAMP
    )
  `);
  console.log('✓ call_campaigns tablosu hazır');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaign_contacts (
      id             SERIAL PRIMARY KEY,
      campaign_id    INTEGER REFERENCES call_campaigns(id) ON DELETE CASCADE,
      phone          VARCHAR(20) NOT NULL,
      name           VARCHAR(200),
      status         VARCHAR(20) DEFAULT 'pending',
      called_at      TIMESTAMP,
      extension_used VARCHAR(50),
      call_log_id    INTEGER REFERENCES call_logs(id) ON DELETE SET NULL,
      attempt_count  INTEGER DEFAULT 0,
      created_at     TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_cc_camp_status ON campaign_contacts(campaign_id, status)
  `);
  console.log('✓ campaign_contacts tablosu hazır');

  await pool.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS break_reason VARCHAR(200)`);
  console.log('✓ agents: break_reason kolonu hazır');

  await pool.query(`ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS disposition VARCHAR(50)`);
  await pool.query(`ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS callback_at TIMESTAMP`);
  console.log('✓ call_logs: disposition + callback_at kolonları hazır');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS appointments (
      id           SERIAL PRIMARY KEY,
      agent_id     INTEGER REFERENCES agents(id) ON DELETE SET NULL,
      customer_id  INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      customer_phone VARCHAR(20),
      customer_name  VARCHAR(200),
      title          VARCHAR(300) NOT NULL,
      notes          TEXT,
      scheduled_at   TIMESTAMP NOT NULL,
      status         VARCHAR(20) DEFAULT 'pending',
      created_at     TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✓ appointments tablosu hazır');

  await pool.end();
  console.log('Migration tamamlandı.');
}

run().catch(err => { console.error(err.message); process.exit(1); });
