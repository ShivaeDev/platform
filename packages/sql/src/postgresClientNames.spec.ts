import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { customNames, datedRowExists, preservedNames, snakeCaseNames } from "#test/clientNameKits.ts";

const noon = new Date("2026-10-01T12:00:00.000Z");
const nextNoon = new Date("2026-10-02T12:00:00.000Z");

snakeCaseNames.it(
	"insert writes the createdAt field to the created_at column and returns it as createdAt",
	[],
	function* ({ insertRow, returned, storedCreatedAt }) {
		yield* insertRow(noon);

		yield* outcomes({
			"returned row": [returned(), { createdAt: noon, id: 1 }],
			"stored created_at column": [storedCreatedAt(), [{ "created_at": noon }]],
		});
	},
);

snakeCaseNames.it(
	"findById and a findMany that selects, filters and orders by createdAt read the created_at column",
	[datedRowExists(snakeCaseNames, noon)],
	function* ({ findByCreatedAt, findById }) {
		yield* outcomes({
			"found by createdAt": [findByCreatedAt(noon), [{ createdAt: noon }]],
			"found by id": [findById(), { createdAt: noon, id: 1 }],
		});
	},
);

snakeCaseNames.it(
	"update writes the created_at column and decodes its RETURNING row into createdAt",
	[datedRowExists(snakeCaseNames, noon)],
	function* ({ returned, storedCreatedAt, updateRow }) {
		yield* updateRow(nextNoon);

		yield* outcomes({
			"returned row": [returned(), { createdAt: nextNoon, id: 1 }],
			"stored created_at column": [storedCreatedAt(), [{ "created_at": nextNoon }]],
		});
	},
);

snakeCaseNames.it(
	"raw SQL writes and filters an interpolated createdAt identifier as created_at and returns rows with createdAt",
	[],
	function* ({ insertRaw, rawCreatedAtWhere }) {
		yield* insertRaw(noon);

		expect(yield* rawCreatedAtWhere(noon)).toEqual([{ createdAt: noon }]);
	},
);

snakeCaseNames.it("a raw SQL stream returns rows with createdAt for the created_at column", [], function* ({ insertRaw, rawCreatedAtStream }) {
	yield* insertRaw(noon);

	expect(yield* rawCreatedAtStream()).toEqual([{ createdAt: noon }]);
});

snakeCaseNames.it("upsert reports an insert for a new row and an update for the same id", [], function* ({ returned, upsertRow }) {
	yield* upsertRow(noon);
	expect(yield* returned()).toEqual({ inserted: true, row: { createdAt: noon, id: 1 } });

	yield* upsertRow(nextNoon);

	expect(yield* returned()).toEqual({ inserted: false, row: { createdAt: nextNoon, id: 1 } });
});

snakeCaseNames.it(
	"upsertMany reports, in input order, an update for the existing row and an insert for the new one",
	[datedRowExists(snakeCaseNames, nextNoon)],
	function* ({ findById, returned, upsertMany }) {
		yield* upsertMany([
			{ createdAt: noon, id: 1 },
			{ createdAt: nextNoon, id: 2 },
		]);

		yield* outcomes({
			"returned results": [
				returned(),
				[
					{ inserted: false, row: { createdAt: noon, id: 1 } },
					{ inserted: true, row: { createdAt: nextNoon, id: 2 } },
				],
			],
			"row 1 as read back": [findById(), { createdAt: noon, id: 1 }],
		});
	},
);

for (const { existing, incoming, result } of [
	{ existing: undefined, incoming: noon, result: "inserted 12:00" },
	{ existing: noon, incoming: new Date("2026-10-01T13:00:00.000Z"), result: "updated 13:00" },
	{ existing: new Date("2026-10-01T13:00:00.000Z"), incoming: noon, result: "unchanged" },
]) {
	snakeCaseNames.it(
		`a conditional upsert through createdAt offering ${incoming.toISOString().slice(11, 16)} ${existing === undefined ? "to no row" : `over a row at ${existing.toISOString().slice(11, 16)}`} reports ${result}`,
		existing === undefined ? [] : [datedRowExists(snakeCaseNames, existing)],
		function* ({ returned, syncWhenNewer }) {
			yield* syncWhenNewer(incoming);

			expect(yield* returned()).toBe(result);
		},
	);
}

preservedNames.it(
	"with snake_case off the repository writes the quoted createdAt column and raw results keep their own names",
	[],
	function* ({ findById, insertRow, rawCreatedAtWithRowId }) {
		yield* insertRow(noon);

		yield* outcomes({
			"found by id": [findById(), { createdAt: noon, id: 1 }],
			"raw columns": [rawCreatedAtWithRowId(), [{ createdAt: noon, "row_id": 1 }]],
		});
	},
);

preservedNames.it(
	"with snake_case off an update writes the quoted createdAt column",
	[datedRowExists(preservedNames, noon)],
	function* ({ rawCreatedAtWithRowId, updateRow }) {
		yield* updateRow(nextNoon);

		expect(yield* rawCreatedAtWithRowId()).toEqual([{ createdAt: nextNoon, "row_id": 1 }]);
	},
);

customNames.it("explicit native name transforms take precedence over the snake_case default", [], function* ({ insertRow, rawCreatedAtWithRowId }) {
	yield* insertRow(noon);

	expect(yield* rawCreatedAtWithRowId()).toEqual([{ createdAt: noon, "row_id": 1 }]);
});
