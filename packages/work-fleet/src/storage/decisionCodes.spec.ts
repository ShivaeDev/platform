import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { backfillDecisionCodes } from "#storage/backfillDecisionCodes.ts";
import { migrateFleet } from "#storage/migrateFleet.ts";
import { codedDecisionRecord, legacyDecisionRecord } from "#test/legacyDecisionRecords.ts";
import { legacyStore } from "#test/legacyStore.ts";
import { postgresTests } from "#test/postgres.ts";
import { readDecisionRecords } from "#test/readDecisionRecords.ts";
import { withStorage } from "#test/storage.ts";

postgresTests("live", "isolated")("backfills current and archived decisions without changing publication receipts or existing codes", () =>
	withStorage((_store, namespace) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* legacyStore(namespace);
			yield* migrateFleet(namespace, true);
			yield* sql`insert into ${sql(`${namespace}_records`)} (work_id, version, payload) values ('one', 1, ${JSON.stringify(legacyDecisionRecord)}::jsonb)`;
			yield* migrateFleet(namespace);
			const rows = yield* readDecisionRecords(namespace);
			expect(rows).toEqual([{ payload: codedDecisionRecord, version: 2 }]);
			yield* migrateFleet(namespace);
			yield* backfillDecisionCodes(namespace);
			expect(yield* readDecisionRecords(namespace)).toEqual(rows);
		}),
	),
);
