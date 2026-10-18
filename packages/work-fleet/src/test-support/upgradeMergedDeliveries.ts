import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { legacyStore } from "#test/legacyStore.ts";
import { migrateFleet } from "#test/migrateFleet.ts";
import { STORAGE_NAMESPACE } from "#test/StorageRecord.ts";

export const upgradeMergedDeliveries = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const reasons = yield* sql`select work_id, "releaseReason" from ${sql(`${STORAGE_NAMESPACE}_records`)}`;
	yield* legacyStore(STORAGE_NAMESPACE);
	yield* migrateFleet(STORAGE_NAMESPACE, "answer_requests");
	for (const row of reasons) {
		yield* sql`update ${sql(`${STORAGE_NAMESPACE}_records`)} set "releaseReason" = ${row.releaseReason} where work_id = ${row.work_id}`;
	}
	yield* migrateFleet(STORAGE_NAMESPACE);
	yield* sql`alter table ${sql(`${STORAGE_NAMESPACE}_records`)} add column "operationId" text, add column "sessionId" text,
		add column "submittedAt" double precision, add column "turnId" text`;
});
