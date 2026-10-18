export function databaseProbe() {
	return `
import { writeFileSync } from "node:fs";
import process from "node:process";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { Pool } from "pg";
import { afterAll, it } from "vitest";
import { postgres } from "./test-support/postgres.ts";

const environment = { "DATABASE_URL": process.env.DATABASE_URL, "TEST_DATABASE_URL": process.env.TEST_DATABASE_URL };
const connections = Object.entries(environment).map(([key, value]) => ({ key, url: new URL(value ?? "") }));

it("records the generated app environment and database observations", async () => {
  const databases: Record<string, unknown> = {};
  for (const { key, url } of connections) {
    const pool = new Pool({ connectionString: url.toString() });
    try {
      databases[key] = (await pool.query("SELECT current_database() AS name")).rows;
    } finally {
      await pool.end();
    }
  }
  const query = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql\`select 1 as value\`;
  }).pipe(Effect.provide(postgres))));
  writeFileSync("database-observations.json", JSON.stringify({ environment, databases, query }));
});

afterAll(async () => {
  for (const { url } of connections) {
    const admin = new URL(url);
    admin.pathname = "/postgres";
    const pool = new Pool({ connectionString: admin.toString() });
    try {
      await pool.query('DROP DATABASE "' + url.pathname.slice(1) + '"');
    } finally {
      await pool.end();
    }
  }
});
`;
}
