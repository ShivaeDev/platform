import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { FleetRecord } from "#model.ts";
import { recordColumns } from "#storage/model.ts";
import { childTable } from "#storage/recordChildren.ts";
import { collections, recordShape, shapeColumns, sqlTypes } from "#storage/recordShape.ts";
import { prepared } from "#test/preparation.ts";
import { isolatedStorage } from "#test/storageStory.ts";
import { byName } from "#test/storageVerbs.ts";

const NAMESPACE = "fleet_schema";
const ROOT_COLUMNS = [
	{ name: "admission_order", type: "bigint" },
	{ name: "version", type: "integer" },
	{ name: "work_id", type: "text" },
	...Object.entries(recordColumns()).map(([name, kind]) => ({ name, type: sqlTypes[kind] })),
].toSorted(byName);
const CHILD_COLUMNS = collections(recordShape()).map((collection) => ({
	columns: [
		{ name: "work_id", type: "text" },
		...Array.from({ length: collection.parents.length + 1 }, (_unused, index) => ({ name: `position${index}`, type: "integer" })),
		...Object.entries(shapeColumns(collection.shape)).map(([name, kind]) => ({ name, type: sqlTypes[kind] })),
	].toSorted(byName),
	table: childTable(NAMESPACE, collection.path),
}));

for (const [path, start] of [
	["a fresh database", undefined],
	["an upgrade from the JSONB model", "attention_owner"],
	["an upgrade from the first typed model", "orchestrator_decisions"],
] as const) {
	isolatedStorage.it(
		`after ${path} every record and child table column has the PostgreSQL type of its schema kind`,
		[],
		function* ({ columns, migrate }) {
			if (start !== undefined) {
				yield* migrate(NAMESPACE, start);
			}

			yield* migrate(NAMESPACE);

			yield* outcomes([
				["record columns", () => columns(`${NAMESPACE}_records`), ROOT_COLUMNS],
				[
					"child columns",
					() => Effect.forEach(CHILD_COLUMNS, ({ table }) => columns(table).pipe(Effect.map((found) => ({ columns: found, table })))),
					CHILD_COLUMNS,
				],
			]);
		},
	);
}

const LEGACY: FleetRecord = {
	attempts: [],
	boardRevision: "revision",
	cwd: "/synthetic",
	preparation: prepared(),
	prompt: "Synthetic upgrade work",
	stage: "done",
	step: "done",
	workId: "upgrade",
};
const UPGRADE = "fleet_upgrade";

isolatedStorage.it(
	"an existing typed table gains the release reason column and its records load unchanged",
	[],
	function* ({ columns, upgradedTypedRecord }) {
		const store = yield* upgradedTypedRecord(UPGRADE, LEGACY);

		yield* outcomes([
			[
				"release reason column",
				() => columns(`${UPGRADE}_records`).pipe(Effect.map((found) => found.some(({ name }) => name === "releaseReason"))),
				true,
			],
			["upgraded record", () => store.load(LEGACY.workId), { value: LEGACY, version: 4 }],
		]);
	},
);

isolatedStorage.it("an upgraded record keeps its release reason through a save and a reload", [], function* ({ upgradedTypedRecord }) {
	const store = yield* upgradedTypedRecord(UPGRADE, LEGACY);
	const edited = yield* store.compareAndSet(LEGACY.workId, 4, { ...LEGACY, prompt: "Edited legacy work" });
	const released = { ...edited.value, releaseReason: "Work is no longer approved", stage: "released", step: "released" } satisfies FleetRecord;

	const saved = yield* store.compareAndSet(LEGACY.workId, edited.version, released);

	expect(saved).toEqual({ value: { ...released, stageEnteredAt: expect.any(Number), updatedAt: expect.any(Number) }, version: 6 });
	expect(yield* store.load(LEGACY.workId)).toEqual(saved);
});
