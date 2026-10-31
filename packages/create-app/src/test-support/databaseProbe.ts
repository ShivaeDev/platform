export function databaseProbe() {
	return `
import { writeFileSync } from "node:fs";
import process from "node:process";
import { Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { it } from "vitest";
import { postgres } from "./test-support/postgres.ts";

const environment = { "DATABASE_URL": process.env.DATABASE_URL, "TEST_DATABASE_URL": process.env.TEST_DATABASE_URL };
const connections = Object.entries(environment).map(([key, value]) => ({ key, url: new URL(value ?? "") }));

function queryDatabase(url: URL, text: string) {
  return Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql.unsafe(text);
  }).pipe(Effect.provide(postgresLayer(Redacted.make(url.toString()))), Effect.scoped);
}

// The scoped test layer creates, migrates and drops databases; PostgreSQL checkpoint waits during cleanup can exceed 5s under parallel CI workers.
it("records the generated app environment and database observations", async () => {
  const databases: Record<string, unknown> = {};
  for (const { key, url } of connections) {
    databases[key] = await Effect.runPromise(queryDatabase(url, "SELECT current_database() AS name"));
  }
  const query = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql\`select 1 as value\`;
  }).pipe(Effect.provide(postgres))));
  writeFileSync("database-observations.json", JSON.stringify({ environment, databases, query }));
}, 30_000);

`;
}
