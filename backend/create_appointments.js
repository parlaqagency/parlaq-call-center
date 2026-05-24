require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.query(`
  CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES agents(id),
    customer_id INTEGER REFERENCES customers(id),
    customer_phone VARCHAR(20),
    customer_name VARCHAR(100),
    title VARCHAR(200) NOT NULL,
    notes TEXT,
    scheduled_at TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => {
  console.log('appointments tablosu oluşturuldu');
  pool.end();
}).catch(e => {
  console.error(e.message);
  pool.end();
});
