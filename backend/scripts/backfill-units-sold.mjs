/**
 * Backfills Sale.unitsSold for the 13 sales identified by audit-units-sold.mjs.
 *
 * These sales were created through the staff/realtor report forms, which never
 * transmitted `unitsSold`, so they stored the schema default of 1. The true
 * count is recovered as areaSold / 465 (one plot = 465 sqm). That relationship
 * was validated 14/14 against sales created via the admin flow, which did
 * record the real count.
 *
 * Safety properties:
 *   - Dry run by default. Requires --apply to write.
 *   - Targets an explicit ID allowlist. Never a broad `WHERE unitsSold = 1`.
 *   - Re-verifies each row's current areaSold and unitsSold before updating.
 *     Any drift since the audit aborts that row.
 *   - Writes a revert file (pre-change values) BEFORE applying.
 *   - Runs in a single transaction per tenant; any mismatch rolls back.
 *
 * Usage:
 *   node backend/scripts/backfill-units-sold.mjs                # dry run
 *   node backend/scripts/backfill-units-sold.mjs --apply        # write
 *   node backend/scripts/backfill-units-sold.mjs --revert <file>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client as PgClient } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const envArg = args.includes('--env') ? args[args.indexOf('--env') + 1] : '.env.vercel.tmp';
const revertArg = args.includes('--revert') ? args[args.indexOf('--revert') + 1] : null;

const PLOT_SQM = 465;

/** Explicit allowlist produced by audit-units-sold.mjs. */
const TARGETS = [
  { id: 'a4caef24-c2c8-4006-84cd-2507ebd9ec39', areaSold: 930,  from: 1, to: 2 },
  { id: 'ecaf38d5-320e-46b3-9da8-5fc51e0963e3', areaSold: 930,  from: 1, to: 2 },
  { id: 'ea735d44-4de5-4183-93d6-6501fcfd6234', areaSold: 930,  from: 1, to: 2 },
  { id: '483454bb-3334-4923-a468-e742cb7266fe', areaSold: 1395, from: 1, to: 3 },
  { id: '599a2112-dd67-43ea-a619-fcdff70fb697', areaSold: 930,  from: 1, to: 2 },
  { id: 'bb90cea3-5ccd-48db-96cf-056883aa72eb', areaSold: 930,  from: 1, to: 2 },
  { id: '0ca401dd-a02c-46c1-9759-235129cebcf3', areaSold: 930,  from: 1, to: 2 },
  { id: '174f6b9a-36e4-4434-9dd6-d00831c91a41', areaSold: 930,  from: 1, to: 2 },
  { id: '20cac390-b6ea-4fa4-8979-a5bd2429d3e0', areaSold: 2325, from: 1, to: 5 },
  { id: '31d101b6-bb0f-485d-ae8a-092b0fe1a45e', areaSold: 1395, from: 1, to: 3 },
  { id: '4e17c581-3c3c-44d2-b9ec-6b875e11686b', areaSold: 2790, from: 1, to: 6 },
  { id: '5eb19ba1-062d-45f3-adbf-ea5bdc32c849', areaSold: 1395, from: 1, to: 3 },
  { id: '7dfc49db-c757-4d3c-966e-e53f47f91c68', areaSold: 930,  from: 1, to: 2 },
];

function loadEnv(file) {
  const full = path.isAbsolute(file) ? file : path.join(__dirname, '..', file);
  if (!fs.existsSync(full)) { console.error(`Env file not found: ${full}`); process.exit(1); }
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

function toSessionMode(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('pooler.supabase.com') && u.port === '6543') u.port = '5432';
    u.searchParams.delete('pgbouncer');
    u.searchParams.delete('connection_limit');
    return u.toString();
  } catch { return url; }
}

const env = loadEnv(envArg);

// ── Resolve the easyland tenant DB ──────────────────────────────────────────
const masterPg = new PgClient({
  connectionString: toSessionMode(env['MASTER_DATABASE_URL']),
  ssl: { rejectUnauthorized: false },
});
await masterPg.connect();
const { rows: companies } = await masterPg.query(
  `SELECT id, slug, "databaseUrl" FROM companies WHERE "isActive" = true AND slug = 'easyland'`,
);
await masterPg.end();

if (companies.length !== 1) {
  console.error(`Expected exactly 1 active 'easyland' company, found ${companies.length}. Aborting.`);
  process.exit(1);
}

const pg = new PgClient({
  connectionString: toSessionMode(companies[0].databaseUrl),
  ssl: { rejectUnauthorized: false },
});
await pg.connect();

// ── Revert mode ─────────────────────────────────────────────────────────────
if (revertArg) {
  const revert = JSON.parse(fs.readFileSync(revertArg, 'utf8'));
  console.log(`REVERT from ${revertArg} — ${revert.rows.length} row(s)`);
  if (!APPLY) {
    console.log('(dry run — pass --apply to actually revert)');
    for (const r of revert.rows) console.log(`  ${r.id}  -> unitsSold = ${r.unitsSold}`);
    await pg.end();
    process.exit(0);
  }
  await pg.query('BEGIN');
  for (const r of revert.rows) {
    await pg.query(`UPDATE sales SET "unitsSold" = $1 WHERE id = $2`, [r.unitsSold, r.id]);
  }
  await pg.query('COMMIT');
  console.log(`Reverted ${revert.rows.length} row(s).`);
  await pg.end();
  process.exit(0);
}

// ── Verify current state ────────────────────────────────────────────────────
console.log(`Mode     : ${APPLY ? 'APPLY (will write)' : 'DRY RUN (no writes)'}`);
console.log(`Tenant   : easyland`);
console.log(`Targets  : ${TARGETS.length}\n`);

const ids = TARGETS.map(t => t.id);
const { rows: current } = await pg.query(
  `SELECT id, "areaSold", "unitsSold" FROM sales WHERE id = ANY($1::text[])`, [ids],
);
const byId = new Map(current.map(r => [r.id, r]));

const ok = [];
const problems = [];

for (const t of TARGETS) {
  const row = byId.get(t.id);
  if (!row) { problems.push(`${t.id}  NOT FOUND in database`); continue; }
  const area = Number(row.areaSold);
  const units = Number(row.unitsSold);
  if (area !== t.areaSold) {
    problems.push(`${t.id}  areaSold drifted: audit saw ${t.areaSold}, now ${area}`);
    continue;
  }
  if (units !== t.from) {
    problems.push(`${t.id}  unitsSold already changed: expected ${t.from}, now ${units}`);
    continue;
  }
  const recomputed = area / PLOT_SQM;
  if (Math.abs(recomputed - t.to) > 0.01) {
    problems.push(`${t.id}  recomputed ${recomputed} != planned ${t.to}`);
    continue;
  }
  ok.push({ ...t, currentUnits: units });
}

for (const o of ok) console.log(`  OK   ${o.id}  areaSold=${String(o.areaSold).padStart(5)}  ${o.from} -> ${o.to}`);
for (const p of problems) console.log(`  SKIP ${p}`);

console.log('');
console.log(`Verified : ${ok.length}`);
console.log(`Problems : ${problems.length}`);

if (problems.length > 0) {
  console.error('\nAborting: state drifted since the audit. Re-run audit-units-sold.mjs.');
  await pg.end();
  process.exit(1);
}

if (!APPLY) {
  console.log('\nDry run complete. No changes made. Re-run with --apply to write.');
  await pg.end();
  process.exit(0);
}

// ── Write revert file, then apply in a transaction ──────────────────────────
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const revertFile = path.join(__dirname, `revert-units-sold-${stamp}.json`);
fs.writeFileSync(revertFile, JSON.stringify({
  createdAt: new Date().toISOString(),
  tenant: 'easyland',
  note: 'Pre-change unitsSold values. Restore with --revert <this file> --apply',
  rows: ok.map(o => ({ id: o.id, unitsSold: o.currentUnits })),
}, null, 2));
console.log(`\nRevert file written: ${revertFile}`);

await pg.query('BEGIN');
let updated = 0;
try {
  for (const o of ok) {
    // Guard the UPDATE itself so a concurrent write can't be clobbered.
    const res = await pg.query(
      `UPDATE sales SET "unitsSold" = $1 WHERE id = $2 AND "unitsSold" = $3 AND "areaSold" = $4`,
      [o.to, o.id, o.from, o.areaSold],
    );
    if (res.rowCount !== 1) throw new Error(`${o.id}: expected 1 row updated, got ${res.rowCount}`);
    updated += res.rowCount;
  }
  await pg.query('COMMIT');
} catch (e) {
  await pg.query('ROLLBACK');
  console.error(`\nFAILED — transaction rolled back. No changes applied.\n${e.message}`);
  await pg.end();
  process.exit(1);
}

console.log(`\nApplied: ${updated} row(s) updated.`);

// ── Post-verify ─────────────────────────────────────────────────────────────
const { rows: after } = await pg.query(
  `SELECT id, "areaSold", "unitsSold" FROM sales WHERE id = ANY($1::text[]) ORDER BY id`, [ids],
);
let mismatch = 0;
for (const t of TARGETS) {
  const row = after.find(r => r.id === t.id);
  if (Number(row.unitsSold) !== t.to) { console.error(`  MISMATCH ${t.id}: ${row.unitsSold} != ${t.to}`); mismatch++; }
}
console.log(mismatch === 0
  ? 'Post-verify: all rows hold their expected values.'
  : `Post-verify: ${mismatch} mismatch(es) — investigate.`);

await pg.end();
