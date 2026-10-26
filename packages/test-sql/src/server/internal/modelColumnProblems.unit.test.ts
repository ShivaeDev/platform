import { Schema } from "effect";
import { Model } from "effect/schema";
import { expect, it } from "vitest";
import { modelColumnProblems } from "#internal/modelColumnProblems.ts";

class Row extends Model.Class<Row>("Row")({ id: Model.GeneratedByDb(Schema.Number), title: Schema.String }) {}

it("the model assertion reports every mismatch independently of column order", () => {
	const types = { id: "integer", title: "text" };
	expect(
		modelColumnProblems(
			[
				{ name: "title", type: "text" },
				{ name: "id", type: "integer" },
			],
			Row.fields,
			types,
			undefined,
		),
	).toEqual([]);
	expect(
		modelColumnProblems(
			[
				{ name: "id", type: "bigint" },
				{ name: "extra", type: "boolean" },
			],
			Row.fields,
			types,
			undefined,
		),
	).toEqual(["Wrong type for id: expected integer, received bigint", "Missing column: title", "Extra column: extra"]);
});

it("the type map cannot silently drift from the model at runtime", () => {
	const problems = modelColumnProblems(
		[
			{ name: "id", type: "integer" },
			{ name: "title", type: "text" },
		],
		Row.fields,
		{ id: "integer", stale: "text" },
		undefined,
	);
	expect(problems).toContain("Missing expected PostgreSQL type: title");
	expect(problems).toContain("Extra expected PostgreSQL type: stale");
});
