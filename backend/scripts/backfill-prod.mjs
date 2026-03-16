/**
 * Production backfill script — multi-tenant aware.
 * 1. Reads all companies from the master DB
 * 2. For each tenant DB: creates general_ledger table (if missing) + backfills entries
 * Run: node scripts/backfill-prod.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client as PgClient } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(__dirname, '..', '.env.production');

// ── Parse .env.production ─────────────────────────────────────────────────────
const raw = fs.readFileSync(envFile, 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx);
  env[key] = trimmed.slice(eqIdx + 1).replace(/^"|"$/g, '').replace(/\\n/g, '').trim();
}

// Switch pooler URL from transaction (6543) → session (5432) for DDL
function toSessionMode(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('pooler.supabase.com') && u.port === '6543') u.port = '5432';
    u.searchParams.delete('pgbouncer');
    u.searchParams.delete('connection_limit');
    return u.toString();
  } catch { return url; }
}

// ── Connect to master DB and fetch all companies ───────────────────────────────
const masterUrl = toSessionMode(env['MASTER_DATABASE_URL']);
console.log('Connecting to master DB...');
const masterPg = new PgClient({ connectionString: masterUrl, ssl: { rejectUnauthorized: false } });
await masterPg.connect();

const { rows: companies } = await masterPg.query(
  `SELECT id, slug, "databaseUrl" FROM companies WHERE "isActive" = true ORDER BY "createdAt"`
);
await masterPg.end();
console.log(`Found ${companies.length} active tenant(s)\n`);

// ── DDL to add general_ledger to a tenant schema ──────────────────────────────
function buildDDL(schema) {
  const s = schema ? `SET search_path TO "${schema}";` : '';
  return `
${s}
DO $$ BEGIN
  CREATE TYPE "LedgerEntryType" AS ENUM ('SALE_PAYMENT', 'EXPENSE', 'COMMISSION', 'COMMISSION_PAYOUT', 'TAX');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "general_ledger" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "entryType"     "LedgerEntryType" NOT NULL,
  "referenceId"   TEXT NOT NULL,
  "referenceType" TEXT NOT NULL,
  "debitAccount"  TEXT NOT NULL,
  "creditAccount" TEXT NOT NULL,
  "amount"        DECIMAL(15,2) NOT NULL,
  "entryDate"     TIMESTAMP(3) NOT NULL,
  "description"   TEXT,
  "metadata"      JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "general_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "general_ledger_referenceId_referenceType_entryType_key"
  ON "general_ledger"("referenceId", "referenceType", "entryType");

CREATE INDEX IF NOT EXISTS "general_ledger_entryType_idx"   ON "general_ledger"("entryType");
CREATE INDEX IF NOT EXISTS "general_ledger_referenceId_idx" ON "general_ledger"("referenceId");
CREATE INDEX IF NOT EXISTS "general_ledger_entryDate_idx"   ON "general_ledger"("entryDate");
`;
}

// ── Extract schema name from a Prisma tenant URL ──────────────────────────────
function extractSchema(dbUrl) {
  try {
    const u = new URL(dbUrl);
    return u.searchParams.get('schema') || null;
  } catch { return null; }
}

// ── Backfill a single tenant ──────────────────────────────────────────────────
async function backfillTenant(company) {
  const { id, slug, databaseUrl } = company;
  const schema = extractSchema(databaseUrl);
  const connUrl = toSessionMode(databaseUrl);

  console.log(`\n── Tenant: ${slug} (schema: ${schema ?? 'public'}) ──`);

  const pg = new PgClient({ connectionString: connUrl, ssl: { rejectUnauthorized: false } });
  try {
    await pg.connect();
  } catch (e) {
    console.error(`  ✗ Cannot connect: ${e.message}`);
    return { slug, error: e.message };
  }

  try {
    // Step 1: create the table — send each statement individually (avoid DO-block split issues)
    if (schema) await pg.query(`SET search_path TO "${schema}"`);
    const ddlStatements = [
      `CREATE TYPE IF NOT EXISTS "LedgerEntryType" AS ENUM ('SALE_PAYMENT', 'EXPENSE', 'COMMISSION', 'COMMISSION_PAYOUT', 'TAX')`,
      // ↑ Not valid syntax — use DO block via pg's multi-statement support:
    ];
    // Use pg's ability to send raw multi-statement strings (simple query protocol)
    try {
      await pg.query(`DO $x$ BEGIN CREATE TYPE "LedgerEntryType" AS ENUM ('SALE_PAYMENT','EXPENSE','COMMISSION','COMMISSION_PAYOUT','TAX'); EXCEPTION WHEN duplicate_object THEN null; END $x$`);
    } catch (e) { /* already exists */ }
    try {
      await pg.query(`
        CREATE TABLE IF NOT EXISTS "general_ledger" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
          "entryType" "LedgerEntryType" NOT NULL,
          "referenceId" TEXT NOT NULL, "referenceType" TEXT NOT NULL,
          "debitAccount" TEXT NOT NULL, "creditAccount" TEXT NOT NULL,
          "amount" DECIMAL(15,2) NOT NULL, "entryDate" TIMESTAMP(3) NOT NULL,
          "description" TEXT, "metadata" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "general_ledger_pkey" PRIMARY KEY ("id")
        )
      `);
    } catch (e) { /* already exists */ }
    for (const idx of [
      `CREATE UNIQUE INDEX IF NOT EXISTS "general_ledger_referenceId_referenceType_entryType_key" ON "general_ledger"("referenceId","referenceType","entryType")`,
      `CREATE INDEX IF NOT EXISTS "general_ledger_entryType_idx" ON "general_ledger"("entryType")`,
      `CREATE INDEX IF NOT EXISTS "general_ledger_referenceId_idx" ON "general_ledger"("referenceId")`,
      `CREATE INDEX IF NOT EXISTS "general_ledger_entryDate_idx" ON "general_ledger"("entryDate")`,
    ]) { try { await pg.query(idx); } catch {} }
    console.log(`  ✓ general_ledger table ready`);

    // Step 2: backfill from existing records
    let count = 0;

    // Full-plan completed sales
    const { rows: fullSales } = await pg.query(`
      SELECT s.id, s."salePrice", s."saleDate",
             c.id AS "commissionId", c.amount AS "commissionAmount",
             t.id AS "taxId", t.amount AS "taxAmount"
      FROM sales s
      LEFT JOIN commissions c ON c."saleId" = s.id
      LEFT JOIN taxes t ON t."saleId" = s.id
      WHERE s."paymentPlan" = 'FULL' AND s.status = 'COMPLETED'
    `);

    for (const sale of fullSales) {
      await upsertLedger(pg, {
        entryType: 'SALE_PAYMENT', referenceId: sale.id, referenceType: 'SALE',
        debitAccount: 'Cash', creditAccount: 'Revenue',
        amount: sale.salePrice, entryDate: sale.saleDate,
        description: `Full payment — Sale ${sale.id}`,
        metadata: JSON.stringify({ saleId: sale.id }),
      });
      count++;

      if (sale.commissionId) {
        await upsertLedger(pg, {
          entryType: 'COMMISSION', referenceId: sale.commissionId, referenceType: 'COMMISSION',
          debitAccount: 'Commission Expense', creditAccount: 'Commission Payable',
          amount: sale.commissionAmount, entryDate: sale.saleDate,
          description: `Commission — Sale ${sale.id}`,
          metadata: JSON.stringify({ saleId: sale.id }),
        });
        count++;
      }

      if (sale.taxId) {
        await upsertLedger(pg, {
          entryType: 'TAX', referenceId: sale.taxId, referenceType: 'TAX',
          debitAccount: 'Tax Expense', creditAccount: 'Tax Payable',
          amount: sale.taxAmount, entryDate: sale.saleDate,
          description: `Tax — Sale ${sale.id}`,
          metadata: JSON.stringify({ saleId: sale.id }),
        });
        count++;
      }
    }
    console.log(`  ✓ ${fullSales.length} full-plan sales`);

    // Installment payments
    const { rows: payments } = await pg.query(`
      SELECT p.id, p.amount, p."paymentDate", p."saleId",
             p."commissionAmount", p."taxAmount",
             c.id AS "commissionId",
             t.id AS "taxId",
             s."paymentPlan"
      FROM payments p
      JOIN sales s ON s.id = p."saleId"
      LEFT JOIN commissions c ON c."saleId" = s.id
      LEFT JOIN taxes t ON t."saleId" = s.id
      WHERE p.status = 'COMPLETED' AND s."paymentPlan" = 'INSTALLMENT'
    `);

    for (const pmt of payments) {
      const ratio = Number(pmt.salePrice) > 0 ? Number(pmt.amount) / Number(pmt.salePrice) : 0;

      await upsertLedger(pg, {
        entryType: 'SALE_PAYMENT', referenceId: pmt.id, referenceType: 'PAYMENT',
        debitAccount: 'Cash', creditAccount: 'Revenue',
        amount: pmt.amount, entryDate: pmt.paymentDate,
        description: `Installment payment — Sale ${pmt.saleId}`,
        metadata: JSON.stringify({ saleId: pmt.saleId, paymentId: pmt.id }),
      });
      count++;

      // Use payment.id as referenceId for commission/tax — matches ledger.service.ts backfill()
      if (pmt.commissionId && Number(pmt.commissionAmount) > 0) {
        await upsertLedger(pg, {
          entryType: 'COMMISSION', referenceId: pmt.id, referenceType: 'PAYMENT',
          debitAccount: 'Commission Expense', creditAccount: 'Commission Payable',
          amount: Number(pmt.commissionAmount).toFixed(2), entryDate: pmt.paymentDate,
          description: `Commission — Payment ${pmt.id}`,
          metadata: JSON.stringify({ saleId: pmt.saleId, paymentId: pmt.id }),
        });
        count++;
      }

      if (pmt.taxId && Number(pmt.taxAmount) > 0) {
        await upsertLedger(pg, {
          entryType: 'TAX', referenceId: pmt.id, referenceType: 'PAYMENT',
          debitAccount: 'Tax Expense', creditAccount: 'Tax Payable',
          amount: Number(pmt.taxAmount).toFixed(2), entryDate: pmt.paymentDate,
          description: `Tax — Payment ${pmt.id}`,
          metadata: JSON.stringify({ saleId: pmt.saleId, paymentId: pmt.id }),
        });
        count++;
      }
    }
    console.log(`  ✓ ${payments.length} installment payments`);

    // Approved expenses — reconnect in case pooler dropped the connection
    await pg.end().catch(() => {});
    const pg2 = new PgClient({ connectionString: connUrl, ssl: { rejectUnauthorized: false } });
    await pg2.connect();
    if (schema) await pg2.query(`SET search_path TO "${schema}"`);
    const { rows: expenses } = await pg2.query(`
      SELECT id, amount, "expenseDate", title, "categoryId"
      FROM expenses
      WHERE "deletedAt" IS NULL AND "approvalStatus" = 'APPROVED'
    `);

    for (const exp of expenses) {
      await upsertLedger(pg2, {
        entryType: 'EXPENSE', referenceId: exp.id, referenceType: 'EXPENSE',
        debitAccount: 'Expense', creditAccount: 'Cash',
        amount: exp.amount, entryDate: exp.expenseDate,
        description: exp.title,
        metadata: JSON.stringify({ categoryId: exp.categoryId }),
      });
      count++;
    }
    console.log(`  ✓ ${expenses.length} expenses`);
    console.log(`  → ${count} total ledger entries written`);
    await pg2.end().catch(() => {});
    return { slug, count };

  } catch (e) {
    console.error(`  ✗ Backfill error: ${e.message}`);
    return { slug, error: e.message };
  } finally {
    await pg.end().catch(() => {});
  }
}

async function upsertLedger(pg, row) {
  await pg.query(`
    INSERT INTO "general_ledger"
      ("entryType", "referenceId", "referenceType", "debitAccount", "creditAccount", "amount", "entryDate", "description", "metadata")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
    ON CONFLICT ("referenceId", "referenceType", "entryType") DO NOTHING
  `, [row.entryType, row.referenceId, row.referenceType, row.debitAccount, row.creditAccount,
      row.amount, row.entryDate, row.description, row.metadata]);
}

// ── Clean up wrong entries from previous backfill run ────────────────────────
async function cleanupWrongEntries(company) {
  const { slug, databaseUrl } = company;
  const schema = extractSchema(databaseUrl);
  const connUrl = toSessionMode(databaseUrl);
  const pg = new PgClient({ connectionString: connUrl, ssl: { rejectUnauthorized: false } });
  try {
    await pg.connect();
    if (schema) await pg.query(`SET search_path TO "${schema}"`);
    // Delete entries created by the old script that used wrong referenceType keys
    const res = await pg.query(`
      DELETE FROM "general_ledger"
      WHERE "referenceType" IN ('COMMISSION_PAYMENT', 'TAX_PAYMENT')
    `);
    console.log(`  [${slug}] Removed ${res.rowCount} wrong-keyed entries`);
  } finally {
    await pg.end().catch(() => {});
  }
}

// ── Run for all tenants ───────────────────────────────────────────────────────
const results = [];
for (const company of companies) {
  await cleanupWrongEntries(company);
  results.push(await backfillTenant(company));
}

console.log('\n══ Summary ══');
for (const r of results) {
  if (r.error) console.log(`  ${r.slug}: FAILED — ${r.error}`);
  else console.log(`  ${r.slug}: ${r.count} entries`);
}
