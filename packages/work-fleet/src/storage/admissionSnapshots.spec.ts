import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { it } from "@shivaedev/effect-test/it.ts";
import { StorageAdmission } from "#storage/errors.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { record, StorageRecord, storageDatabaseUrl, storageOptions, withStorage } from "#test/storage.ts";

const test = it.live.skipIf(storageDatabaseUrl === undefined);

test("custom admission reads current records by default and still runs when it opts out of the snapshot", () =>
	withStorage((base, namespace) =>
		Effect.gen(function* () {
			yield* base.insert(record("other"));
			const seen: string[][] = [];
			const store = yield* makePostgresFleetStore(StorageRecord, {
				...storageOptions(namespace),
				admission: (_record, _previous, records) =>
					Effect.sync(() => {
						seen.push(records.map((value) => value.workId));
					}),
			});
			yield* store.insert(record("one"));
			expect(seen).toEqual([["other"]]);
			const rejecting = yield* makePostgresFleetStore(StorageRecord, {
				...storageOptions(namespace),
				admission: (_record, _previous, records) => {
					expect(records).toEqual([]);
					return Effect.fail(new StorageAdmission({ message: "Denied by application" }));
				},
				admissionNeedsRecords: () => false,
			});
			expect(yield* rejecting.insert(record("denied")).pipe(Effect.flip)).toMatchObject({ _tag: "StorageAdmission" });
			expect(yield* base.load("denied")).toBeUndefined();
		}),
	));

test("opting out of application snapshots retains live foreign capacity and shared quota checks", () =>
	withStorage((base, namespace) =>
		Effect.gen(function* () {
			const store = yield* makePostgresFleetStore(StorageRecord, {
				...storageOptions(namespace),
				admission: () => Effect.void,
				admissionNeedsRecords: () => false,
			});
			yield* base.reserveForeign("external", { backlog: true, executing: true });
			expect(yield* store.insert({ ...record("one"), stage: "submitting" }, { maxExecuting: 1 }).pipe(Effect.flip)).toMatchObject({
				_tag: "StorageCapacity",
				kind: "execution",
			});
			yield* base.releaseForeign("external");
			yield* base.insert({ ...record("submitted"), stage: "submitting", submittedAt: 101 });
			expect(
				yield* store
					.insert({ ...record("two"), stage: "submitting", submittedAt: 101 }, { quota: { available: 1, observedAt: 100 } })
					.pipe(Effect.flip),
			).toMatchObject({ _tag: "StorageQuota", reason: "exhausted" });
			expect((yield* base.list()).map(({ value }) => value.workId)).toEqual(["submitted"]);
		}),
	));

test("single and batch reads retain typed schema failures for malformed nested JSON", () =>
	withStorage((store, namespace) =>
		Effect.gen(function* () {
			yield* store.insert(record("one"));
			const sql = yield* SqlClient.SqlClient;
			yield* sql`update ${sql(`${namespace}_records`)} set attempts = '{' where work_id = 'one'`;
			expect(yield* store.load("one").pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
			expect(yield* store.list().pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
		}),
	));
