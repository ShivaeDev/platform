import { Effect } from "effect";
import { inspectionChanges } from "#server/adapters/inspectionChanges.ts";
import { PgBoss } from "#server/PgBoss.ts";
export const changes = Effect.fn("PgBossInspectionReads.changes")(function* (queue?: { readonly name: string }) {
	const { client, schema } = yield* PgBoss;
	return yield* inspectionChanges(client, schema ?? "pgboss", queue?.name);
});
