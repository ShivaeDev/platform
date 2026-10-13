import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { expect, it } from "vitest";
import { assertModelColumns } from "./assertModelColumns.ts";

class Row extends Model.Class<Row>("Row")({ id: Model.GeneratedByDb(Schema.Number), title: Schema.String }) {}

it("the model assertion reports every mismatch independently of column order", () => {
	const types = { id: "integer", title: "text" };
	Effect.runSync(
		assertModelColumns(
			[
				{ name: "title", type: "text" },
				{ name: "id", type: "integer" },
			],
			Row,
			types,
		),
	);
	const mismatch = Effect.runSync(
		assertModelColumns(
			[
				{ name: "id", type: "bigint" },
				{ name: "extra", type: "boolean" },
			],
			Row,
			types,
		).pipe(Effect.flip),
	);
	expect(mismatch._tag).toBe("ModelColumnMismatch");
	expect(mismatch.problems).toEqual(["Wrong type for id: expected integer, received bigint", "Missing column: title", "Extra column: extra"]);
});

it("the type map cannot silently drift from the model at runtime", () => {
	const model: Model.Any = Row;
	const mismatch = Effect.runSync(
		assertModelColumns(
			[
				{ name: "id", type: "integer" },
				{ name: "title", type: "text" },
			],
			model,
			{ id: "integer", stale: "text" },
		).pipe(Effect.flip),
	);
	expect(mismatch.problems).toContain("Missing expected PostgreSQL type: title");
	expect(mismatch.problems).toContain("Extra expected PostgreSQL type: stale");
});
