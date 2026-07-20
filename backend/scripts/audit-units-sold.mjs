/**
 * READ-ONLY audit of Sale.unitsSold across all tenant databases.
 *
 * Background: the staff and realtor sale-report forms never sent `unitsSold`,
 * so every sale created through them stored the schema default of 1. The real
 * plot count was never transmitted and exists nowhere on the server. This
 * script does NOT fix anything — it reports how far a count could be *inferred*
 * from areaSold, and how trustworthy that inference is.
 *
 * Inference: a "plot" is 465 sqm (frontend/src/lib/utils.ts AREA_UNITS.plot).
 *   inferred = areaSold / 465
 *
 * Usage:
 *   node backend/scripts/audit-units-sold.mjs [--env <file>] [--csv <out.csv>]
 * Defaults to backend/.env.vercel.tmp (production).
 *
 * This script issues SELECT statements only.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client as PgClient } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const envArg = args.includes('--env') ? args[args.indexOf('--env') + 1] : '.env.vercel.tmp';
const csvArg = args.includes('--csv') ? args[args.indexOf('--csv') + 1] : null;

const PLOT_SQM = 465;

function loadEnv(file) {
  const full = path.isAbsolute(file) ? file : path.join(__dirname, '..', file);
  if (!fs.existsSync(full)) {
    console.error(`Env file not found: ${full}`);
    process.exit(1);
  }
  const env = {};
  for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    env[t.slice(0, eq)] = t.slice(eq + 1).replace(/^"|"$/g, '').replace(/\\n/g, '').trim();
  }
  return env;
}

/** Supabase pooler port 6543 is transaction mode; 5432 is session mode. */
function toSessionMode(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('pooler.supabase.com') && u.port === '6543') u.port = '5432';
    u.searchParams.delete('pgbouncer');
    u.searchParams.delete('connection_limit');
    return u.toString();
  } catch { return url; }
}

function describe(url) {
  try { const u = new URL(url); return `${u.hostname}:${u.port}${u.pathname}`; }
  catch { return '(unparseable url)'; }
}

const env = loadEnv(envArg);
console.log(`Env file : ${envArg}`);
console.log(`Master   : ${describe(env['MASTER_DATABASE_URL'])}`);
console.log(`READ-ONLY — no writes will be issued.\n`);

// ── Resolve tenant databases ────────────────────────────────────────────────
const targets = [];
if (env['MASTER_DATABASE_URL']) {
  const masterPg = new PgClient({
    connectionString: toSessionMode(env['MASTER_DATABASE_URL']),
    ssl: { rejectUnauthorized: false },
  });
  await masterPg.connect();
  const { rows } = await masterPg.query(
    `SELECT id, slug, "databaseUrl" FROM companies WHERE "isActive" = true ORDER BY slug`,
  );
  await masterPg.end();
  for (const c of rows) {
    if (c.databaseUrl) targets.push({ label: c.slug, url: c.databaseUrl });
  }
}
// Fall back to the primary DATABASE_URL if the master lists no tenants.
if (targets.length === 0 && env['DATABASE_URL']) {
  targets.push({ label: 'default', url: env['DATABASE_URL'] });
}

if (targets.length === 0) {
  console.error('No target databases resolved.');
  process.exit(1);
}
console.log(`Tenants  : ${targets.length}\n`);

// ── Audit each tenant ───────────────────────────────────────────────────────
const csvRows = [['tenant', 'saleId', 'saleDate', 'property', 'type', 'salePrice',
                  'areaSold', 'propertyArea', 'storedUnits', 'inferred', 'verdict']];
const totals = { CONFIDENT: 0, AMBIGUOUS: 0, EXCEEDS_PROPERTY: 0, NO_AREA: 0, NOT_LAND: 0, ALREADY_SET: 0 };
let grandTotal = 0;

for (const t of targets) {
  const pg = new PgClient({
    connectionString: toSessionMode(t.url),
    ssl: { rejectUnauthorized: false },
  });
  try {
    await pg.connect();
  } catch (e) {
    console.log(`--- ${t.label}: CONNECTION FAILED (${e.message})\n`);
    continue;
  }

  let rows;
  try {
    ({ rows } = await pg.query(`
      SELECT s.id, s."saleDate", s."salePrice", s."areaSold", s."unitsSold",
             p.title AS property_title, p.type AS property_type, p.area AS property_area
      FROM sales s
      LEFT JOIN properties p ON p.id = s."propertyId"
      ORDER BY s."saleDate" DESC
    `));
  } catch (e) {
    console.log(`--- ${t.label}: QUERY FAILED (${e.message})\n`);
    await pg.end();
    continue;
  }
  await pg.end();

  const counts = { CONFIDENT: 0, AMBIGUOUS: 0, EXCEEDS_PROPERTY: 0, NO_AREA: 0, NOT_LAND: 0, ALREADY_SET: 0 };
  const detail = [];

  for (const r of rows) {
    const area = r.areaSold === null ? null : Number(r.areaSold);
    const stored = Number(r.unitsSold);
    const propArea = r.property_area === null ? null : Number(r.property_area);
    const isLand = String(r.property_type || '').toUpperCase() === 'LAND';

    let inferred = null;
    let verdict;

    if (stored > 1) {
      // Recorded after the fix, or set deliberately — leave alone.
      verdict = 'ALREADY_SET';
    } else if (!isLand) {
      verdict = 'NOT_LAND';
    } else if (area === null || area === 0) {
      verdict = 'NO_AREA';
    } else {
      const raw = area / PLOT_SQM;
      inferred = Math.round(raw);
      const isClean = Math.abs(raw - inferred) < 0.01 && inferred >= 1;
      // The forms prefilled sqmSold with the WHOLE property area, so an
      // areaSold equal to (or above) the property area is almost certainly
      // that prefill left untouched, not a real multi-plot purchase.
      const exceeds = propArea !== null && propArea > 0 && area >= propArea;
      if (exceeds) verdict = 'EXCEEDS_PROPERTY';
      else if (isClean) verdict = 'CONFIDENT';
      else verdict = 'AMBIGUOUS';
    }

    counts[verdict]++;
    totals[verdict]++;
    grandTotal++;

    if (verdict === 'CONFIDENT' || verdict === 'AMBIGUOUS' || verdict === 'EXCEEDS_PROPERTY') {
      detail.push({ r, area, propArea, stored, inferred, verdict });
    }
    csvRows.push([
      t.label, r.id,
      r.saleDate ? new Date(r.saleDate).toISOString().slice(0, 10) : '',
      `"${String(r.property_title || '').replace(/"/g, '""')}"`,
      r.property_type || '', r.salePrice ?? '',
      area ?? '', propArea ?? '', stored, inferred ?? '', verdict,
    ]);
  }

  console.log(`--- ${t.label} — ${rows.length} sale(s)`);
  for (const [k, v] of Object.entries(counts)) if (v) console.log(`      ${k.padEnd(18)} ${v}`);

  if (detail.length) {
    console.log('');
    console.log('      ' + 'saleId'.padEnd(38) + 'date'.padEnd(12) + 'areaSold'.padStart(10)
                + 'propArea'.padStart(11) + 'stored'.padStart(8) + 'infer'.padStart(7) + '  verdict');
    for (const d of detail) {
      console.log('      '
        + String(d.r.id).padEnd(38)
        + (d.r.saleDate ? new Date(d.r.saleDate).toISOString().slice(0, 10) : '').padEnd(12)
        + String(d.area ?? '').padStart(10)
        + String(d.propArea ?? '').padStart(11)
        + String(d.stored).padStart(8)
        + String(d.inferred ?? '').padStart(7)
        + '  ' + d.verdict);
    }
  }
  console.log('');
}

// ── Summary ─────────────────────────────────────────────────────────────────
console.log('='.repeat(72));
console.log(`TOTAL SALES: ${grandTotal}`);
console.log('');
console.log(`  CONFIDENT        ${String(totals.CONFIDENT).padStart(5)}  land, areaSold a clean multiple of ${PLOT_SQM}, below property area`);
console.log(`  AMBIGUOUS        ${String(totals.AMBIGUOUS).padStart(5)}  land, but areaSold is NOT a clean multiple — inference unreliable`);
console.log(`  EXCEEDS_PROPERTY ${String(totals.EXCEEDS_PROPERTY).padStart(5)}  areaSold >= whole property area — almost certainly the form prefill`);
console.log(`  NO_AREA          ${String(totals.NO_AREA).padStart(5)}  no areaSold recorded — nothing to infer from`);
console.log(`  NOT_LAND         ${String(totals.NOT_LAND).padStart(5)}  non-land; areaSold is building area, not plots`);
console.log(`  ALREADY_SET      ${String(totals.ALREADY_SET).padStart(5)}  unitsSold > 1 already — leave alone`);
console.log('');
console.log(`Only CONFIDENT rows are defensible candidates for a backfill.`);
console.log(`Everything else would be a guess written onto a customer receipt.`);

if (csvArg) {
  fs.writeFileSync(csvArg, csvRows.map(r => r.join(',')).join('\n'));
  console.log(`\nCSV written: ${csvArg}`);
}
