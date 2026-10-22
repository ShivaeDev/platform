import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { StorageAdmission } from "#storage/errors.ts";
import { makePostgresFleetStore } from "#storage/makePostgresFleetStore.ts";
import { StorageRecord } from "#test/StorageRecord.ts";
import { record, storageOptions } from "#test/storage.ts";
import { storage } from "#test/storageStory.ts";

const test = storage;

test.it(
	"custom admission reads current records by default and still runs when it opts out of the snapshot",
	[],
	function* ({ store: base, namespace }) {
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
	},
);

test.it("opting out of application snapshots retains live foreign capacity and shared quota checks", [], function* ({ store: base, namespace }) {
	const store = yield* makePostgresFleetStore(StorageRecord, {
		...storageOptions(namespace),
		admission: () => Effect.void,
		admissionNeedsRecords: () => false,
	});
	yield* base.reserveForeign("external", { backlog: true, executing: true });
	expect(yield* store.insert({ ...record("one"), step: "submitting" }, { maxExecuting: 1 }).pipe(Effect.flip)).toMatchObject({
		_tag: "StorageCapacity",
		kind: "execution",
	});
	yield* base.releaseForeign("external");
	yield* base.insert({ ...record("submitted"), step: "submitting", submittedAt: 101 });
	expect(
		yield* store.insert({ ...record("two"), step: "submitting", submittedAt: 101 }, { quota: { available: 1, observedAt: 100 } }).pipe(Effect.flip),
	).toMatchObject({ _tag: "StorageQuota", reason: "exhausted" });
	expect((yield* base.list()).map(({ value }) => value.workId)).toEqual(["submitted"]);
});

test.it("single and batch reads retain typed schema failures for invalid persisted stages", [], function* ({ store, namespace, sql }) {
	yield* store.insert(record("one"));

	yield* sql`update ${sql(`${namespace}_records`)} set step = 'invalid-step' where work_id = 'one'`;
	expect(yield* store.load("one").pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
	expect(yield* store.list().pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
});
