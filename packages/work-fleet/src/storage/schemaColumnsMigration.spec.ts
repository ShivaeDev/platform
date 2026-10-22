import { expect } from "vitest";
import type { FleetRecord } from "#model.ts";
import { recordColumns } from "#storage/model.ts";
import { childTable } from "#storage/recordChildren.ts";
import { collections, recordShape, shapeColumns, sqlTypes } from "#storage/recordShape.ts";
import { prepared } from "#test/preparation.ts";
import { isolatedStorage } from "#test/storageStory.ts";

const test = isolatedStorage;

for (const path of ["fresh", "upgrade", "typed upgrade"] as const) {
	test.it(`${path} database columns, PostgreSQL types and logical kinds match the Fleet record schema`, [], function* ({ sql, migrate }) {
		const namespace = "fleet_schema";
		const table = `${namespace}_records`;
		if (path === "upgrade") {
			yield* migrate(namespace, "attention_owner");
			expect(yield* sql`select max(migration_id) as latest from ${sql(`${namespace}_migrations`)}`).toEqual([{ latest: 4 }]);
		}
		if (path === "typed upgrade") {
			yield* migrate(namespace, "orchestrator_decisions");
		}
		yield* migrate(namespace);
		const columns = yield* sql<{ readonly name: string; readonly type: string }>`
			select attname as name, format_type(atttypid, atttypmod) as type from pg_attribute
			where attrelid = ${table}::regclass and attnum > 0 and not attisdropped`;
		const types = sqlTypes;
		const expected = [
			{ name: "admission_order", type: "bigint" },
			{ name: "version", type: "integer" },
			{ name: "work_id", type: "text" },
			...Object.entries(recordColumns()).map(([name, kind]) => ({ name, type: types[kind] })),
		];
		function byName(left: { readonly name: string }, right: { readonly name: string }) {
			return left.name.localeCompare(right.name, "en");
		}
		expect([...columns].sort(byName)).toEqual(expected.sort(byName));
		for (const collection of collections(recordShape())) {
			const child = childTable(namespace, collection.path);
			const actual = yield* sql<{
				readonly name: string;
				readonly type: string;
			}>`select attname as name, format_type(atttypid, atttypmod) as type from pg_attribute where attrelid = ${child}::regclass and attnum > 0 and not attisdropped`;
			const expectedChild = [
				{ name: "work_id", type: "text" },
				...Array.from({ length: collection.parents.length + 1 }, (_unused, index) => ({ name: `position${index}`, type: "integer" })),
				...Object.entries(shapeColumns(collection.shape)).map(([name, kind]) => ({ name, type: types[kind] })),
			];
			expect([...actual].sort(byName)).toEqual(expectedChild.sort(byName));
		}
	});
}

test.it("existing model tables gain every Fleet schema column and persist release reasons", [], function* ({ sql, migrate, openFleetStore }) {
	const namespace = "fleet_upgrade";
	const table = `${namespace}_records`;
	yield* migrate(namespace, "decision_codes");
	const before = yield* sql<{ readonly name: string }>`
			select attname as name from pg_attribute where attrelid = ${table}::regclass and attnum > 0 and not attisdropped`;
	expect(before.map((column) => column.name)).not.toContain("releaseReason");
	const value: FleetRecord = {
		attempts: [],
		boardRevision: "revision",
		cwd: "/synthetic",
		preparation: prepared(),
		prompt: "Synthetic upgrade work",
		stage: "done",
		step: "done",
		workId: "upgrade",
	};
	yield* sql`insert into ${sql(table)} (work_id, version, attempts, "boardRevision", cwd, preparation, prompt, stage)
			values (${value.workId}, 3, '[]', ${value.boardRevision}, ${value.cwd}, ${JSON.stringify(value.preparation)}, ${value.prompt}, ${"completed"})`;
	const store = yield* openFleetStore({ namespace });
	yield* migrate(namespace);
	expect(yield* store.load(value.workId)).toEqual({ value, version: 4 });
	const updated = yield* store.compareAndSet(value.workId, 4, { ...value, prompt: "Edited legacy work" });
	expect(updated.value.stageEnteredAt).toBeUndefined();
	expect(updated.value.completedAt).toBeUndefined();
	expect(updated.value.updatedAt).toEqual(expect.any(Number));
	const released = { ...updated.value, releaseReason: "Work is no longer approved", stage: "released", step: "released" } satisfies FleetRecord;
	const saved = yield* store.compareAndSet(value.workId, updated.version, released);
	expect(saved).toMatchObject({ value: { ...released, stageEnteredAt: expect.any(Number), updatedAt: expect.any(Number) }, version: 6 });
	expect(yield* store.load(value.workId)).toEqual(saved);
	const inserted = yield* store.insert({ ...released, workId: "new" });
	expect(yield* store.list()).toEqual([saved, inserted]);
	expect(yield* migrate(namespace)).toEqual([]);
	expect(yield* store.list()).toEqual([saved, inserted]);
});
