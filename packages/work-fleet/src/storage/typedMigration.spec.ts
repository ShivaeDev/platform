import { Effect } from "effect";
import { expect } from "vitest";
import { childTable } from "#storage/recordChildren.ts";
import { isolatedStorage } from "#test/storageStory.ts";
import { legacyTypedMigrationRecords, typedMigrationRecords } from "#test/typedMigrationRecords.ts";

const test = isolatedStorage;

test.it(
	"text records migrate every current and archived field, preserving empty and absent structures, order and versions",
	[],
	function* ({ sql, migrate, seedTextRecords, openFleetStore }) {
		const namespace = "typed_upgrade";
		const values = typedMigrationRecords();
		const legacy = legacyTypedMigrationRecords();
		yield* seedTextRecords(namespace, legacy);
		yield* sql`insert into ${sql(`${namespace}_foreign_reservations`)} (owner, executing, backlog) values ('external', false, true)`;
		const before = yield* sql`select work_id, admission_order, version from ${sql(`${namespace}_records`)} order by admission_order`;
		const store = yield* openFleetStore({ namespace });
		yield* migrate(namespace);
		const expected = values.map((value, index) => ({ value, version: index + 6 }));
		expect(yield* store.list()).toEqual(expected);
		for (const entry of expected) {
			expect(yield* store.load(entry.value.workId)).toEqual(entry);
		}
		expect(yield* sql`select work_id, admission_order, version from ${sql(`${namespace}_records`)} order by admission_order`).toEqual(before);
		expect(yield* store.foreignReservations()).toEqual([{ areas: [], backlog: true, executing: false, owner: "external" }]);
		expect(yield* store.operationEntries("operation")).toHaveLength(3);
		expect(yield* migrate(namespace)).toEqual([]);
		expect(yield* store.list()).toEqual(expected);
		const first = expected[0];
		if (first === undefined) {
			return yield* Effect.die("Missing populated fixture");
		}
		const changed = yield* store.compareAndSet(first.value.workId, first.version, {
			...first.value,
			attempts: [],
			history: undefined,
			launch: {},
			pendingAnswers: undefined,
		});
		expect(yield* store.load(first.value.workId)).toEqual(changed);
		expect(yield* store.operationEntries("operation")).toEqual([]);
		expect((yield* store.compareAndSet(first.value.workId, first.version, first.value).pipe(Effect.flip))._tag).toBe("StorageConflict");
		expect(yield* store.load(first.value.workId)).toEqual(changed);
	},
);

test.it(
	"an invalid text field rolls back the whole upgrade and retains the source for a repaired retry",
	[],
	function* ({ sql, migrate, seedTextRecords, openFleetStore }) {
		const namespace = "typed_retry";
		const values = typedMigrationRecords();
		yield* seedTextRecords(namespace, values);
		yield* sql`update ${sql(`${namespace}_records`)} set ${sql("integrationRetry")} = '{' where work_id = 'empty'`;
		const before = yield* sql`select * from ${sql(`${namespace}_records`)} order by admission_order`;
		expect((yield* migrate(namespace).pipe(Effect.exit))._tag).toBe("Failure");
		expect(yield* sql`select * from ${sql(`${namespace}_records`)} order by admission_order`).toEqual(before);
		expect(yield* sql`select migration_id from ${sql(`${namespace}_migrations`)} where migration_id = 12`).toEqual([]);
		expect(yield* sql`select to_regclass(${childTable(namespace, ["attempts"])}) as child`).toEqual([{ child: null }]);
		yield* sql`update ${sql(`${namespace}_records`)} set ${sql("integrationRetry")} = null where work_id = 'empty'`;
		const store = yield* openFleetStore({ namespace });
		yield* migrate(namespace);
		expect((yield* store.list()).map((entry) => entry.value)).toEqual(
			values.map((value) => (value.workId === "empty" ? { ...value, integrationRetry: undefined } : value)),
		);
	},
);

test.it("a child write failure rolls back root fields, versions and replaced children together", [], function* ({ sql, migrate, openFleetStore }) {
	const namespace = "typed_atomic";
	const store = yield* openFleetStore({ namespace });
	yield* migrate(namespace);
	const value = typedMigrationRecords()[0];
	if (value === undefined) {
		return yield* Effect.die("Missing populated fixture");
	}
	const saved = yield* store.insert(value);
	yield* sql`alter table ${sql(childTable(namespace, ["attempts"]))} add check (${sql("operationId")} <> 'rejected')`;
	const rejected = { operationId: "rejected", role: "worker" as const, status: "completed" as const, submittedAt: 1 };
	expect(
		(yield* store.compareAndSet(value.workId, saved.version, { ...saved.value, attempts: [rejected], prompt: "new prompt" }).pipe(Effect.flip))._tag,
	).toBe("SqlError");
	expect(yield* store.load(value.workId)).toEqual(saved);
});
