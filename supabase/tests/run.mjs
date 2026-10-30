// Runs the SQL migrations and backend tests against a throwaway embedded PostgreSQL.
//   npm run test:db
//
// This is plain Postgres plus a small stand-in for Supabase's `auth` schema and roles
// (supabase/tests/prelude.sql). It validates our schema, RLS policies and functions.
// It does NOT exercise GoTrue, PostgREST or Realtime; those are Supabase's own services.
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dir = mkdtempSync(join(tmpdir(), 'tukosafe-pg-'));
const port = Number(process.env.TEST_PG_PORT || 54329);

const pg = new EmbeddedPostgres({
  databaseDir: dir, user: 'postgres', password: 'postgres', port, persistent: false,
  onLog: () => {}, onError: () => {},
});

let failed = false;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('tukosafe_test');
  const client = pg.getPgClient();
  await client.connect();
  await client.query('select 1').catch(() => {});
  // getPgClient connects to the default db; switch via a dedicated client
  await client.end();

  const { default: pgmod } = await import('pg');
  const c = new pgmod.Client({ host: 'localhost', port, user: 'postgres', password: 'postgres', database: 'tukosafe_test' });
  const notices = [];
  c.on('notice', (n) => notices.push(n.message));
  await c.connect();

  const run = async (label, sql) => {
    try {
      await c.query(sql);
      console.log(`ok   ${label}`);
    } catch (e) {
      failed = true;
      console.error(`FAIL ${label}\n     ${e.message}${e.where ? `\n     at ${e.where.split('\n')[0]}` : ''}`);
      await c.query('rollback').catch(() => {});
      throw e;
    }
  };

  await run('prelude (auth stub, roles)', readFileSync(join(here, 'prelude.sql'), 'utf8'));
  for (const f of readdirSync(join(root, 'migrations')).filter((x) => x.endsWith('.sql') && !(process.env.SKIP_MIGRATION && x.includes(process.env.SKIP_MIGRATION))).sort()) {
    await run(`migration ${f}`, readFileSync(join(root, 'migrations', f), 'utf8'));
  }
  for (const f of readdirSync(here).filter((x) => /^\d+_.*\.sql$/.test(x) || x === 'multi_user.sql').sort()) {
    notices.length = 0;
    await run(`test ${f}`, readFileSync(join(here, f), 'utf8'));
    notices.filter((m) => /^(PASS|FAIL)/.test(m)).forEach((m) => console.log(`     ${m}`));
  }
  await c.end();
} catch {
  failed = true;
} finally {
  await pg.stop().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
}
console.log(failed ? '\nDB TESTS FAILED' : '\nALL DB TESTS PASSED');
process.exit(failed ? 1 : 0);
