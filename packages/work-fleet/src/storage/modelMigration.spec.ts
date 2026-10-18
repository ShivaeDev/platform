import { Effect } from "effect";
import { expect } from "vitest";
import { migrationRecords } from "#test/migrationRecords.ts";
import { isolatedStorage } from "#test/storageStory.ts";

const test = isolatedStorage;

test.it(
	"populated JSONB records migrate without changing records, versions, order or foreign reservations",
	[],
	function* ({ namespace, sql, restoreLegacy, migrate, openFleetStore }) {
		yield* restoreLegacy(namespace);
		yield* migrate(namespace, "attention_owner");
		yield* sql`select setval(pg_get_serial_sequence(${`${namespace}_records`}, 'admission_order'), 9007199254740993, false)`;
		const values = migrationRecords();
		for (const [index, value] of values.entries()) {
			yield* sql`insert into ${sql(`${namespace}_records`)} (work_id, version, payload) values (${value.workId}, ${index + 7}, ${JSON.stringify(value)}::jsonb)`;
		}
		yield* sql`insert into ${sql(`${namespace}_foreign_reservations`)} (owner, executing, backlog) values ('external', false, true)`;
		const before = yield* sql`select work_id, admission_order from ${sql(`${namespace}_records`)} order by admission_order`;
		let requeue = false;
		const store = yield* openFleetStore({ namespace, requeue: () => requeue });
		yield* migrate(namespace);
		const expected = values.map((value, index) => ({ value, version: index + 7 }));
		expect(yield* store.list()).toEqual(expected);
		for (const entry of expected) {
			expect(yield* store.load(entry.value.workId)).toEqual(entry);
		}
		expect(yield* store.foreignReservations()).toEqual([{ areas: [], backlog: true, executing: false, owner: "external" }]);
		expect(yield* sql`select work_id, admission_order from ${sql(`${namespace}_records`)} order by admission_order`).toEqual(before);
		expect(yield* migrate(namespace)).toEqual([]);
		const first = expected[0];
		if (first === undefined) {
			return yield* Effect.die("Missing migrated record");
		}
		const unchanged = yield* store.compareAndSet(first.value.workId, first.version, first.value);
		expect(yield* sql`select work_id, admission_order from ${sql(`${namespace}_records`)} order by admission_order`).toEqual(before);
		requeue = true;
		const saved = yield* store.compareAndSet(first.value.workId, unchanged.version, { ...first.value, areas: undefined, mergeReadyAt: undefined });
		expect(saved.version).toBe(first.version + 2);
		expect(yield* sql`select admission_order from ${sql(`${namespace}_records`)} where work_id = ${first.value.workId}`).toEqual([
			{
				"admission_order": 9007199254740995n,
			},
		]);
		expect((yield* store.load(first.value.workId))?.value.areas).toBeUndefined();
		expect((yield* store.list()).map((entry) => entry.value.workId)).toEqual(["two", "one"]);
		expect((yield* store.compareAndSet(first.value.workId, first.version, first.value).pipe(Effect.flip))._tag).toBe("StorageConflict");
		expect(
			yield* sql`select column_name from information_schema.columns where table_name = ${`${namespace}_records`} and column_name = 'payload'`,
		).toEqual([]);
	},
);

test.it(
	"a failed model migration retains the source records and ledger for a repaired retry",
	[],
	function* ({ namespace, sql, restoreLegacy, migrate, openFleetStore }) {
		yield* restoreLegacy(namespace);
		yield* migrate(namespace, "attention_owner");
		const value = migrationRecords()[0];
		if (value === undefined) {
			return yield* Effect.die("Missing migration fixture");
		}
		const invalid = { ...value, mergeReadyAt: "invalid-number" };
		yield* sql`insert into ${sql(`${namespace}_records`)} (work_id, version, payload) values (${value.workId}, 9, ${JSON.stringify(invalid)}::jsonb)`;
		expect((yield* migrate(namespace).pipe(Effect.exit))._tag).toBe("Failure");
		const rows = yield* sql`select version, payload from ${sql(`${namespace}_records`)} where work_id = ${value.workId}`;
		expect(rows).toEqual([{ payload: invalid, version: 9 }]);
		expect(yield* sql`select migration_id from ${sql(`${namespace}_migrations`)} where migration_id = 5`).toEqual([]);
		yield* sql`update ${sql(`${namespace}_records`)} set payload = ${JSON.stringify(value)}::jsonb where work_id = ${value.workId}`;
		const store = yield* openFleetStore({ namespace });
		yield* migrate(namespace);
		expect(yield* store.load(value.workId)).toEqual({ value, version: 9 });
	},
);
