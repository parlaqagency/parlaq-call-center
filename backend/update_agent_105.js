require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run() {
  const hash = await bcrypt.hash('eylemm123', 10);
  const result = await pool.query(
    `UPDATE agents SET name=$1, sip_password=$2, password_hash=$3 WHERE extension='105' RETURNING id, name, extension, role`,
    ['Eylem Gültekce', 'Eylem123Eylem', hash]
  );
  if (result.rows[0]) {
    console.log('Güncellendi:', result.rows[0]);
  } else {
    console.log('Dahili 105 bulunamadı!');
  }
  pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
