import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client as PgClient } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = fs.readFileSync(path.join(__dirname, '..', '.env.production'), 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('='); if (eq === -1) continue;
  env[t.slice(0, eq)] = t.slice(eq + 1).replace(/^"|"$/g, '').replace(/\\n/g, '').trim();
}
function toSessionMode(url) {
  try { const u = new URL(url); if (u.hostname.includes('pooler.supabase.com') && u.port === '6543') u.port = '5432'; u.searchParams.delete('pgbouncer'); u.searchParams.delete('connection_limit'); return u.toString(); } catch { return url; }
}
function extractSchema(url) { try { return new URL(url).searchParams.get('schema') || null; } catch { return null; } }

const masterPg = new PgClient({ connectionString: toSessionMode(env['MASTER_DATABASE_URL']), ssl: { rejectUnauthorized: false } });
await masterPg.connect();
const { rows: companies } = await masterPg.query(`SELECT id, slug, "databaseUrl" FROM companies WHERE "isActive" = true`);
await masterPg.end();

for (const company of companies) {
  const schema = extractSchema(company.databaseUrl);
  const pg = new PgClient({ connectionString: toSessionMode(company.databaseUrl), ssl: { rejectUnauthorized: false } });
  await pg.connect();
  if (schema) await pg.query(`SET search_path TO "${schema}"`);

  console.log(`\nTenant: ${company.slug}`);

  // Revenue by month
  const { rows } = await pg.query(`
    SELECT
      TO_CHAR("entryDate", 'YYYY-MM') AS month,
      "entryType",
      COUNT(*) cnt,
      SUM(amount) total
    FROM general_ledger
    GROUP BY TO_CHAR("entryDate", 'YYYY-MM'), "entryType"
    ORDER BY month, "entryType"
  `);

  console.log('\nLedger entries by month:');
  console.log('Month      | entryType     | count | total');
  console.log('-'.repeat(55));
  for (const r of rows) {
    console.log(`${r.month}     | ${(r.entrytype||'').padEnd(13)} | ${String(r.cnt).padEnd(5)} | ${Number(r.total).toLocaleString()}`);
  }

  // Revenue totals by month
  const { rows: rev } = await pg.query(`
    SELECT
      TO_CHAR("entryDate", 'YYYY-MM') AS month,
      SUM(CASE WHEN "entryType"='SALE_PAYMENT' THEN amount ELSE 0 END) AS revenue,
      SUM(CASE WHEN "entryType"='EXPENSE'      THEN amount ELSE 0 END) AS expenses,
      SUM(CASE WHEN "entryType"='COMMISSION'   THEN amount ELSE 0 END) AS commission
    FROM general_ledger
    GROUP BY TO_CHAR("entryDate", 'YYYY-MM')
    ORDER BY month
  `);

  console.log('\nFinancial summary by month:');
  console.log('Month      | Revenue        | Expenses       | Commission');
  console.log('-'.repeat(65));
  for (const r of rev) {
    console.log(`${r.month}     | ${Number(r.revenue).toLocaleString().padEnd(14)} | ${Number(r.expenses).toLocaleString().padEnd(14)} | ${Number(r.commission).toLocaleString()}`);
  }

  // Also show what the admin dashboard "yearly" would show
  const { rows: yearly } = await pg.query(`
    SELECT
      SUM(CASE WHEN "entryType"='SALE_PAYMENT' THEN amount ELSE 0 END) AS revenue,
      SUM(CASE WHEN "entryType"='EXPENSE'      THEN amount ELSE 0 END) AS expenses,
      SUM(CASE WHEN "entryType"='COMMISSION'   THEN amount ELSE 0 END) AS commission
    FROM general_ledger
    WHERE "entryDate" >= '2026-01-01' AND "entryDate" < '2027-01-01'
  `);
  console.log(`\nYTD 2026: Revenue=${Number(yearly[0].revenue).toLocaleString()}, Expenses=${Number(yearly[0].expenses).toLocaleString()}, Commission=${Number(yearly[0].commission).toLocaleString()}`);

  await pg.end().catch(() => {});
}
