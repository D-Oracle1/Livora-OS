/**
 * Audit script — shows the exact numbers each page would display and why they differ.
 * Run: node scripts/audit-numbers.mjs
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

// Get master DB companies
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

  const now = new Date();
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const ytdStart = new Date(now.getFullYear(), 0, 1).toISOString();
  const epoch    = '2020-01-01T00:00:00Z';
  const end      = now.toISOString();

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`TENANT: ${company.slug}`);
  console.log(`${'═'.repeat(70)}`);

  // ── 1. What's in the ledger ───────────────────────────────────────────────
  const { rows: ledgerSummary } = await pg.query(`
    SELECT "entryType", "referenceType", COUNT(*) AS cnt, SUM(amount) AS total
    FROM general_ledger
    GROUP BY "entryType", "referenceType"
    ORDER BY "entryType", "referenceType"
  `);

  console.log('\n── LEDGER CONTENTS (all entries) ──');
  console.log('entryType        | referenceType       | count | total');
  console.log('-'.repeat(65));
  for (const r of ledgerSummary) {
    console.log(`${(r.entrytype||r.entryType||'').padEnd(16)} | ${(r.referencetype||r.referenceType||'').padEnd(19)} | ${String(r.cnt).padEnd(5)} | ${Number(r.total).toLocaleString()}`);
  }

  // ── 2. Accounting page numbers ────────────────────────────────────────────
  const acctQ = (start) => pg.query(`
    SELECT
      COALESCE(SUM(CASE WHEN "entryType"='SALE_PAYMENT' THEN amount END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN "entryType"='EXPENSE'      THEN amount END), 0) AS expenses,
      COALESCE(SUM(CASE WHEN "entryType"='COMMISSION'   THEN amount END), 0) AS commission,
      COALESCE(SUM(CASE WHEN "entryType"='TAX'          THEN amount END), 0) AS tax
    FROM general_ledger
    WHERE "entryDate" >= $1 AND "entryDate" <= $2
  `, [start, end]);

  const [mtdAcct, ytdAcct, allTimeAcct] = await Promise.all([acctQ(mtdStart), acctQ(ytdStart), acctQ(epoch)]);
  const mtd = mtdAcct.rows[0];
  const ytd = ytdAcct.rows[0];
  const all = allTimeAcct.rows[0];

  console.log('\n── ACCOUNTING PAGE (from ledger) ──');
  console.log(`                     MTD           YTD         ALL-TIME`);
  console.log(`Revenue:    ${String(Number(mtd.revenue).toFixed(2)).padStart(15)} ${String(Number(ytd.revenue).toFixed(2)).padStart(15)} ${String(Number(all.revenue).toFixed(2)).padStart(15)}`);
  console.log(`Expenses:   ${String(Number(mtd.expenses).toFixed(2)).padStart(15)} ${String(Number(ytd.expenses).toFixed(2)).padStart(15)} ${String(Number(all.expenses).toFixed(2)).padStart(15)}`);
  console.log(`Commission: ${String(Number(mtd.commission).toFixed(2)).padStart(15)} ${String(Number(ytd.commission).toFixed(2)).padStart(15)} ${String(Number(all.commission).toFixed(2)).padStart(15)}`);
  console.log(`Tax:        ${String(Number(mtd.tax).toFixed(2)).padStart(15)} ${String(Number(ytd.tax).toFixed(2)).padStart(15)} ${String(Number(all.tax).toFixed(2)).padStart(15)}`);
  console.log(`Net Profit: ${String((Number(mtd.revenue)-Number(mtd.expenses)-Number(mtd.commission)-Number(mtd.tax)).toFixed(2)).padStart(15)} ${String((Number(ytd.revenue)-Number(ytd.expenses)-Number(ytd.commission)-Number(ytd.tax)).toFixed(2)).padStart(15)} ${String((Number(all.revenue)-Number(all.expenses)-Number(all.commission)-Number(all.tax)).toFixed(2)).padStart(15)}`);

  // ── 3. Sales page stats ───────────────────────────────────────────────────
  const { rows: salesStats } = await pg.query(`
    SELECT
      COUNT(*) FILTER (WHERE status='COMPLETED' AND "paymentPlan"='FULL') AS full_count,
      COUNT(*) FILTER (WHERE status IN ('COMPLETED','IN_PROGRESS') AND "paymentPlan"='INSTALLMENT') AS install_count,
      COUNT(*) FILTER (WHERE status='PENDING') AS pending_count,
      COALESCE(SUM("salePrice") FILTER (WHERE status='COMPLETED' AND "paymentPlan"='FULL'), 0) AS full_revenue_OLD,
      COALESCE(SUM("totalPaid") FILTER (WHERE status IN ('COMPLETED','IN_PROGRESS') AND "paymentPlan"='INSTALLMENT'), 0) AS install_revenue_OLD,
      COALESCE(SUM("commissionAmount") FILTER (WHERE status IN ('COMPLETED','IN_PROGRESS')), 0) AS commission_OLD,
      COALESCE(SUM("taxAmount") FILTER (WHERE status IN ('COMPLETED','IN_PROGRESS')), 0) AS tax_OLD
    FROM sales
  `);
  const ss = salesStats[0];

  console.log('\n── SALES PAGE ──');
  console.log(`Deals closed (full plan):         ${ss.full_count}`);
  console.log(`Deals active (installment):        ${ss.install_count}`);
  console.log(`Pending:                           ${ss.pending_count}`);
  console.log(`--- OLD calculation (pre-fix, Sale table) ---`);
  console.log(`Revenue (full salePrice):          ${Number(ss.full_revenue_old).toFixed(2)}`);
  console.log(`Revenue (install totalPaid):       ${Number(ss.install_revenue_old).toFixed(2)}`);
  console.log(`Revenue TOTAL (old):               ${(Number(ss.full_revenue_old)+Number(ss.install_revenue_old)).toFixed(2)}`);
  console.log(`Commission (old, from Sale table): ${Number(ss.commission_old).toFixed(2)}`);
  console.log(`--- NEW calculation (post-fix, from ledger all-time) ---`);
  console.log(`Revenue (new, ledger):             ${Number(all.revenue).toFixed(2)}`);
  console.log(`Commission (new, ledger):          ${Number(all.commission).toFixed(2)}`);
  console.log(`Tax (new, ledger):                 ${Number(all.tax).toFixed(2)}`);

  // ── 4. Individual sale + payment breakdown ────────────────────────────────
  const { rows: sales } = await pg.query(`
    SELECT s.id, s."saleDate", s."paymentPlan", s.status,
           s."salePrice", s."totalPaid", s."commissionAmount", s."taxAmount"
    FROM sales s
    WHERE s.status NOT IN ('PENDING','CANCELLED')
    ORDER BY s."saleDate"
  `);

  console.log('\n── INDIVIDUAL SALES ──');
  for (const sale of sales) {
    const { rows: pmts } = await pg.query(`
      SELECT id, "paymentDate", amount, "commissionAmount", "taxAmount", status
      FROM payments WHERE "saleId" = $1 ORDER BY "paymentDate"
    `, [sale.id]);

    const { rows: ledgerEntries } = await pg.query(`
      SELECT "entryType", "referenceType", "referenceId", amount, "entryDate"
      FROM general_ledger
      WHERE metadata->>'saleId' = $1 OR "referenceId" = $1
      ORDER BY "entryDate", "entryType"
    `, [sale.id]);

    console.log(`\n  Sale ${sale.id.slice(0,8)}.. | ${sale.paymentplan} | ${sale.status} | saleDate: ${new Date(sale.saledate).toISOString().slice(0,10)}`);
    console.log(`    salePrice: ${Number(sale.saleprice).toFixed(2)} | totalPaid: ${Number(sale.totalpaid).toFixed(2)} | commission: ${Number(sale.commissionamount).toFixed(2)} | tax: ${Number(sale.taxamount).toFixed(2)}`);
    if (pmts.length) {
      console.log(`    Payments (${pmts.length}):`);
      for (const p of pmts) {
        console.log(`      ${new Date(p.paymentdate).toISOString().slice(0,10)} | ${p.status} | amt: ${Number(p.amount).toFixed(2)} | comm: ${Number(p.commissionamount||0).toFixed(2)} | tax: ${Number(p.taxamount||0).toFixed(2)}`);
      }
    }
    if (ledgerEntries.length) {
      console.log(`    Ledger entries (${ledgerEntries.length}):`);
      for (const l of ledgerEntries) {
        console.log(`      ${new Date(l.entrydate).toISOString().slice(0,10)} | ${l.entrytype.padEnd(14)} | ${l.referencetype.padEnd(10)} | ${Number(l.amount).toFixed(2)}`);
      }
    } else {
      console.log(`    ⚠️  NO LEDGER ENTRIES for this sale`);
    }
  }

  // ── 5. Expenses breakdown ─────────────────────────────────────────────────
  const { rows: expSummary } = await pg.query(`
    SELECT COUNT(*) AS cnt, SUM(amount) AS total FROM expenses
    WHERE "deletedAt" IS NULL AND "approvalStatus"='APPROVED'
  `);
  const { rows: expLedger } = await pg.query(`
    SELECT COUNT(*) AS cnt, SUM(amount) AS total FROM general_ledger WHERE "entryType"='EXPENSE'
  `);
  console.log('\n── EXPENSES ──');
  console.log(`Approved expenses (source table): count=${expSummary[0].cnt}, total=${Number(expSummary[0].total).toFixed(2)}`);
  console.log(`Ledger EXPENSE entries:           count=${expLedger[0].cnt}, total=${Number(expLedger[0].total).toFixed(2)}`);

  await pg.end().catch(() => {});
}

console.log('\nAudit complete.');
