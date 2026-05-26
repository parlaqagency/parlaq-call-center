require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const CSV_PATH   = path.join(__dirname, '..', 'dis_klinikleri_callcenter.csv');
const EXTENSIONS = ['101', '102', '103', '104', '105'];

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : false,
});

async function main() {
  // 1. Parse CSV
  const raw   = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const contacts = lines.map(line => {
    const comma = line.indexOf(',');
    if (comma === -1) return null;
    const phone = line.slice(0, comma).replace(/\s+/g, '').trim();
    const name  = line.slice(comma + 1).trim() || null;
    if (!phone || phone.toLowerCase() === 'phone') return null;
    return { phone, name };
  }).filter(Boolean);

  console.log(`CSV okundu: ${contacts.length} kişi`);

  // 2. Ensure columns exist
  await pool.query(`ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS assigned_extension VARCHAR(20)`).catch(() => {});
  await pool.query(`ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS disposition VARCHAR(50)`).catch(() => {});
  await pool.query(`ALTER TABLE campaign_contacts ADD COLUMN IF NOT EXISTS notes TEXT`).catch(() => {});

  // 3. Get or create campaign
  const existing = await pool.query(`SELECT id FROM call_campaigns WHERE name = 'Diş Klinikleri İzmir' LIMIT 1`);
  let campaignId;

  if (existing.rows[0]) {
    campaignId = existing.rows[0].id;
    console.log(`Mevcut kampanya sıfırlanıyor: ID=${campaignId}`);
    await pool.query('DELETE FROM campaign_contacts WHERE campaign_id = $1', [campaignId]);
    await pool.query(
      `UPDATE call_campaigns SET total_contacts=$1, status='pending', started_at=NULL, completed_at=NULL WHERE id=$2`,
      [contacts.length, campaignId]
    );
  } else {
    const adminRow = await pool.query(`SELECT id FROM agents WHERE role='admin' LIMIT 1`);
    if (!adminRow.rows[0]) { console.error('Admin bulunamadı'); process.exit(1); }
    const camp = await pool.query(
      `INSERT INTO call_campaigns (name, notes, created_by, total_contacts, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
      ['Diş Klinikleri İzmir', 'dis_klinikleri_callcenter.csv - otomatik yüklendi', adminRow.rows[0].id, contacts.length]
    );
    campaignId = camp.rows[0].id;
    console.log(`Yeni kampanya oluşturuldu: ID=${campaignId}`);
  }

  // 4. Insert contacts with round-robin extension assignment
  const BATCH = 100;
  for (let i = 0; i < contacts.length; i += BATCH) {
    const chunk  = contacts.slice(i, i + BATCH);
    const vals   = chunk.map((_, j) => `($1, $${j * 3 + 2}, $${j * 3 + 3}, $${j * 3 + 4})`).join(',');
    const params = [campaignId, ...chunk.flatMap((c, j) => [
      c.phone,
      c.name,
      EXTENSIONS[(i + j) % EXTENSIONS.length],
    ])];
    await pool.query(
      `INSERT INTO campaign_contacts (campaign_id, phone, name, assigned_extension) VALUES ${vals}`,
      params
    );
    process.stdout.write(`\r  ${Math.min(i + BATCH, contacts.length)}/${contacts.length} yüklendi...`);
  }
  console.log('\nKişiler eklendi');

  // 5. Also upsert into customers table (for admin Müşteriler panel)
  console.log('Customers tablosuna ekleniyor...');
  for (let i = 0; i < contacts.length; i += BATCH) {
    const chunk  = contacts.slice(i, i + BATCH);
    const values = chunk.map((_, j) => `($${j * 3 + 1}, $${j * 3 + 2}, $${j * 3 + 3})`).join(',');
    const params = chunk.flatMap(c => [(c.name || '').slice(0, 100), c.phone, 'Diş Kliniği']);
    await pool.query(
      `INSERT INTO customers (name, phone, company) VALUES ${values} ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, company=EXCLUDED.company`,
      params
    );
    process.stdout.write(`\r  ${Math.min(i + BATCH, contacts.length)}/${contacts.length} customers...`);
  }
  console.log('\nCustomers eklendi');

  // 6. Show distribution stats
  const stats = await pool.query(
    `SELECT assigned_extension, COUNT(*) FROM campaign_contacts WHERE campaign_id=$1 GROUP BY assigned_extension ORDER BY assigned_extension`,
    [campaignId]
  );
  console.log('\nDağıtım:');
  stats.rows.forEach(r => console.log(`  Dahili ${r.assigned_extension}: ${r.count} lead`));

  await pool.end();
  console.log('\nTamamlandı!');
}

main().catch(err => { console.error(err); process.exit(1); });
