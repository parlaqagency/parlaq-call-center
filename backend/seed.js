require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const AGENTS = [
  { name: 'Çalışan 101', extension: '101', sip_password: 'SgF5Yr3Get' },
  { name: 'Çalışan 102', extension: '102', sip_password: 'Y66f99mvhm' },
  { name: 'Çalışan 103', extension: '103', sip_password: '5CfHT66rVh' },
  { name: 'Özlem Bağ Demir', extension: '104', sip_password: 'Ozlem123Ozlem' },
  { name: 'Çalışan 105', extension: '105', sip_password: 'uFd7C3uMNk' },
];

async function run() {
  console.log('Veritabanına bağlanılıyor...');

  await pool.query(`ALTER TABLE agents ADD COLUMN IF NOT EXISTS sip_password VARCHAR(100)`);
  console.log('✓ sip_password kolonu hazır');

  for (const a of AGENTS) {
    const hash = await bcrypt.hash(a.sip_password, 10);
    await pool.query(`
      INSERT INTO agents (name, extension, sip_password, password_hash, role, status, queue)
      VALUES ($1, $2, $3, $4, 'agent', 'offline', 'satis')
      ON CONFLICT (extension) DO UPDATE SET
        sip_password = EXCLUDED.sip_password,
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        role = 'agent'
    `, [a.name, a.extension, a.sip_password, hash]);
    console.log(`✓ ${a.name}  dahili: ${a.extension}  şifre: ${a.sip_password}`);
  }

  await pool.end();
  console.log('\nTamamlandı. Çalışanlar panele dahili no + SIP şifresiyle giriş yapabilir.');
}

run().catch(err => { console.error(err.message); process.exit(1); });
