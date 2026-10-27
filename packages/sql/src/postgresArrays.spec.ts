import { expect } from "vitest";
import { Sample } from "#test/arraySamples.ts";
import { hasArraySamples } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it(
	"PostgreSQL int4 arrays round-trip empty and non-empty model values through repository writes",
	[hasArraySamples()],
	function* ({ sql, arraySamples }) {
		const { samples, tableName } = arraySamples();
		const full = { id: 1, values: [-2_147_483_648, -1, 0, 2_147_483_647] };
		const empty = { id: 2, values: [] };
		expect(yield* samples.insert(full)).toEqual(full);
		expect(yield* samples.insert(empty)).toEqual(empty);
		expect(yield* samples.findById(1)).toBeInstanceOf(Sample);
		expect(yield* samples.findById(2)).toEqual(empty);
		expect(yield* samples.findMany({ select: ["id", "values"], where: { values: [] } })).toEqual([empty]);
		expect(yield* samples.update({ ...full, values: [] })).toEqual({ id: 1, values: [] });
		yield* samples.updateVoid({ ...empty, values: [1, 2] });
		expect(yield* samples.findById(2)).toEqual({ id: 2, values: [1, 2] });
		expect(
			yield* samples.insertMany([
				{ id: 3, values: [] },
				{ id: 4, values: [3] },
			]),
		).toEqual([
			{ id: 3, values: [] },
			{ id: 4, values: [3] },
		]);
		expect(
			yield* samples.insertManyOrIgnore([
				{ id: 4, values: [] },
				{ id: 5, values: [] },
			]),
		).toEqual([{ id: 5, values: [] }]);
		expect(
			yield* samples.upsertMany(
				[
					{ id: 3, values: [4, 5] },
					{ id: 4, values: [] },
				],
				{ updateColumns: ["values"] },
			),
		).toEqual([
			{ inserted: false, row: { id: 3, values: [4, 5] } },
			{ inserted: false, row: { id: 4, values: [] } },
		]);
		expect(
			yield* sql`select id, pg_typeof(values)::text as type, values is null as missing, cardinality(values)::int as size from ${sql(tableName)} where id = 4`,
		).toEqual([{ id: 4, missing: false, size: 0, type: "integer[]" }]);
	},
);
