import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { assertModelColumns } from "#assertModelColumns.ts";

class Row extends Model.Class<Row>("Row")({ id: Model.GeneratedByDb(Schema.Number), title: Schema.String }) {}

export const model = storyKit({
	create: () => Row,
	name: "model columns",
	stages: ["schema"],
	verbs: (row, story) => ({
		allMismatchesAreReported: () =>
			Effect.gen(function* () {
				story.tell("all column mismatches are reported");
				const types = { id: "integer", title: "text" };
				yield* assertModelColumns(
					[
						{ name: "title", type: "text" },
						{ name: "id", type: "integer" },
					],
					row,
					types,
				);
				const mismatch = yield* assertModelColumns(
					[
						{ name: "id", type: "bigint" },
						{ name: "extra", type: "boolean" },
					],
					row,
					types,
				).pipe(Effect.flip);
				expect(mismatch._tag).toBe("ModelColumnMismatch");
				expect(mismatch.problems).toEqual(["Wrong type for id: expected integer, received bigint", "Missing column: title", "Extra column: extra"]);
			}),
		typeMapDriftIsReported: () =>
			Effect.gen(function* () {
				story.tell("type map drift is reported");
				const runtimeModel: Model.Any = row;
				const mismatch = yield* assertModelColumns(
					[
						{ name: "id", type: "integer" },
						{ name: "title", type: "text" },
					],
					runtimeModel,
					{ id: "integer", stale: "text" },
				).pipe(Effect.flip);
				expect(mismatch.problems).toContain("Missing expected PostgreSQL type: title");
				expect(mismatch.problems).toContain("Extra expected PostgreSQL type: stale");
			}),
	}),
});
