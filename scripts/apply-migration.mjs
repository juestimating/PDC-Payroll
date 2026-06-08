// Applies SQL migrations in supabase/migrations to the project in .env.local.
// Uses the IPv4 Supavisor pooler (direct host is IPv6-only on new projects).
//
//   node scripts/apply-migration.mjs            # apply all migrations in order
//   node scripts/apply-migration.mjs 0001       # apply files matching "0001"
//
// Reads SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL from .env.local. Never
// hardcode secrets here.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const pass = env.SUPABASE_DB_PASSWORD;
if (!url || !pass) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}
const ref = url.match(/https:\/\/([^.]+)\./)[1];
const filter = process.argv[2];

const dir = "supabase/migrations";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql") && (!filter || f.includes(filter)))
  .sort();
const sql = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
console.log("applying:", files.join(", "));

// ap-southeast-1 (aws-1) is this project's region; others are fallbacks.
const COMBOS = [
  "aws-1-ap-southeast-1", "aws-1-ap-south-1", "aws-0-ap-southeast-1",
  "aws-1-us-east-1", "aws-1-eu-central-1", "aws-1-us-west-1",
  "aws-0-us-east-1", "aws-0-eu-west-1",
].map((h) => `${h}.pooler.supabase.com`);

for (const host of COMBOS) {
  const client = new pg.Client({
    host,
    port: 5432,
    user: `postgres.${ref}`,
    password: pass,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    query_timeout: 60000,
  });
  try {
    await client.connect();
    await client.query(sql);
    console.log("applied via", host);
    await client.end();
    process.exit(0);
  } catch (e) {
    console.log(`  ${host}: ${String(e.message).slice(0, 60)}`);
    try { await client.end(); } catch {}
  }
}
console.error("Could not reach the database via any pooler host.");
process.exit(2);
