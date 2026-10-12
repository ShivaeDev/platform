import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { backfillDecisionCodes } from "#storage/backfillDecisionCodes.ts";
import { migrateFleet } from "#storage/migrateFleet.ts";
import { codedDecisionRecord, legacyDecisionRecord } from "#test/legacyDecisionRecords.ts";
import { legacyStore } from "#test/legacyStore.ts";
import { readDecisionRecords } from "#test/readDecisionRecords.ts";
import { storageDatabaseUrl, withStorage } from "#test/storage.ts";

it.live.skipIf(storageDatabaseUrl === undefined)(
	"backfills current and archived decisions without changing publication receipts or existing codes",
	() =>
		withStorage((_store, namespace) =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* legacyStore(namespace);
				yield* migrateFleet(namespace, undefined, true);
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
