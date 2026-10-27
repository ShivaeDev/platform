import { Effect, Schema } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { installPgBossSchema } from "@shivaedev/jobs/server/schema.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";

export const Work = defineQueue({ name: "action-work", schema: Schema.Struct({ id: Schema.Number }), worker: { pollingIntervalSeconds: 0.5 } });
export const Jobs = makePgBoss("action-story/Jobs");
export const migrations = {
	loader: Migrator.fromRecord({
		"1_actions": Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table actions (id integer primary key)`;
			yield* installPgBossSchema();
		}),
	}),
	lockTimeout: "5 seconds" as const,
};
