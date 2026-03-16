/**
 * Removes SALE_PAYMENT/PAYMENT ledger entries that belong to FULL-plan sales.
 * These were created by the first backfill run which didn't filter by paymentPlan.
 * FULL plan sales should only have a SALE_PAYMENT/SALE entry, never a /PAYMENT one.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client as PgClient } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = fs.readFileSync(path.join(__dirname, '..', '.env.production'), 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  env[t.slice(0, eq)] = t.slice(eq + 1).replace(/^"|"$/g, '').replace(/\\n/g, '').trim();
}

function toSessionMode(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('pooler.supabase.com') && u.port === '6543') u.port = '5432';
    u.searchParams.delete('pgbouncer');
    u.searchParams.delete('connection_limit');
    return u.toString();
  } catch { return url; }
}

function extractSchema(url) {
  try { return new URL(url).searchParams.get('schema') || null; } catch { return null; }
}

const masterPg = new PgClient({ connectionString: toSessionMode(env['MASTER_DATABASE_URL']), ssl: { rejectUnauthorized: false } });
await masterPg.connect();
const { rows: companies } = await masterPg.query(`SELECT id, slug, "databaseUrl" FROM companies WHERE "isActive" = true`);
await masterPg.end();

for (const company of companies) {
  const schema = extractSchema(company.databaseUrl);
  const connUrl = toSessionMode(company.databaseUrl);
  const pg = new PgClient({ connectionString: connUrl, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  if (schema) await pg.query(`SET search_path TO "${schema}"`);

  console.log(`\nFixing: ${company.slug}`);

  // Show BEFORE state
  const { rows: before } = await pg.query(`
    SELECT "entryType", "referenceType", COUNT(*) cnt, SUM(amount) total
    FROM general_ledger
    GROUP BY "entryType", "referenceType"
    ORDER BY "entryType", "referenceType"
  `);
  console.log('BEFORE:');
  for (const r of before) {
    console.log(`  ${(r.entrytype||r.entryType).padEnd(14)} / ${(r.referencetype||r.referenceType).padEnd(18)} | ${r.cnt} entries | ${Number(r.total).toLocaleString()}`);
  }

  // Delete SALE_PAYMENT/PAYMENT entries that belong to FULL plan sales
  // Identify them by joining the payment referenceId to the payments table -> sales table
  const deleted = await pg.query(`
    DELETE FROM general_ledger
    WHERE "entryType" = 'SALE_PAYMENT'
      AND "referenceType" = 'PAYMENT'
      AND "referenceId" IN (
        SELECT p.id
        FROM payments p
        JOIN sales s ON s.id = p."saleId"
        WHERE s."paymentPlan" = 'FULL'
      )
  `);
  console.log(`Deleted ${deleted.rowCount} duplicate FULL-plan PAYMENT entries`);

  // Show AFTER state
  const { rows: after } = await pg.query(`
    SELECT "entryType", "referenceType", COUNT(*) cnt, SUM(amount) total
    FROM general_ledger
    GROUP BY "entryType", "referenceType"
    ORDER BY "entryType", "referenceType"
  `);
  console.log('AFTER:');
  for (const r of after) {
    console.log(`  ${(r.entrytype||r.entryType).padEnd(14)} / ${(r.referencetype||r.referenceType).padEnd(18)} | ${r.cnt} entries | ${Number(r.total).toLocaleString()}`);
  }

  // Show final totals
  const { rows: totals } = await pg.query(`
    SELECT
      SUM(CASE WHEN "entryType"='SALE_PAYMENT' THEN amount ELSE 0 END) AS revenue,
      SUM(CASE WHEN "entryType"='EXPENSE'      THEN amount ELSE 0 END) AS expenses,
      SUM(CASE WHEN "entryType"='COMMISSION'   THEN amount ELSE 0 END) AS commission,
      SUM(CASE WHEN "entryType"='TAX'          THEN amount ELSE 0 END) AS tax
    FROM general_ledger
  `);
  const t = totals[0];
  console.log(`\nFINAL TOTALS (all-time):`);
  console.log(`  Revenue:    ${Number(t.revenue).toLocaleString()}`);
  console.log(`  Expenses:   ${Number(t.expenses).toLocaleString()}`);
  console.log(`  Commission: ${Number(t.commission).toLocaleString()}`);
  console.log(`  Tax:        ${Number(t.tax).toLocaleString()}`);
  console.log(`  Net Profit: ${(Number(t.revenue) - Number(t.expenses) - Number(t.commission) - Number(t.tax)).toLocaleString()}`);

  await pg.end().catch(() => {});
}
console.log('\nDone.');
