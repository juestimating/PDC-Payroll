// Ad-hoc read/verify query against the JU Supabase project via the session pooler.
//   node scripts/db-query.mjs "select count(*) from employees"
// Reads SUPABASE_DB_PASSWORD + NEXT_PUBLIC_SUPABASE_URL from .env.local. Read-only
// by intent; never commit secrets here.
import { readFileSync } from "node:fs";
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
const ref = url.match(/https:\/\/([^.]+)\./)[1];
const host = "aws-1-ap-southeast-2.pooler.supabase.com";
const sql = process.argv[2] || "select 1 as ok";

const client = new pg.Client({
  host, port: 5432, user: `postgres.${ref}`, password: pass, database: "postgres",
  ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000, query_timeout: 60000,
});
await client.connect();
try {
  const res = await client.query(sql);
  console.log(JSON.stringify(res.rows, null, 2));
} finally {
  await client.end();
}
