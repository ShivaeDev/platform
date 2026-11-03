import { Context, Effect, Schema, SchemaGetter } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf, it } from "vitest";
import type { BatchedDeleteUnavailable } from "#batchedDelete.ts";
import { deleteGroupsBatched } from "#deleteGroupsBatched.ts";
import { makeRepository } from "#repository.ts";

class RetentionPrefix extends Context.Service<RetentionPrefix, string>()("@shivaedev/sql/RetentionPrefix") {}
const Label = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform((value: string) => value),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(RetentionPrefix, (prefix) => prefix + value)),
	}),
);
class RetentionRow extends Model.Class<RetentionRow>("TypedRetentionRow")({
	id: Schema.Int,
	label: Label,
	version: Model.Field({ json: Schema.Int, select: Schema.Int, update: Schema.Int }),
}) {}

const program = Effect.gen(function* () {
	const rows = yield* makeRepository(RetentionRow, { idColumn: "id", spanPrefix: "Retention", tableName: "retention" });
	const options = { batchSize: 100, maxRows: 1000, pause: "100 millis", where: { id: { lt: 5 }, label: "old" } } as const;
	const result = rows.deleteBatched(options);
	expectTypeOf<Effect.Success<typeof result>>().toEqualTypeOf<number>();
	expectTypeOf<Effect.Error<typeof result>>().toEqualTypeOf<SqlError | Schema.SchemaError | BatchedDeleteUnavailable>();
	expectTypeOf<Effect.Services<typeof result>>().toEqualTypeOf<RetentionPrefix>();
	// @ts-expect-error Filters use the model's decoded field types.
	rows.deleteBatched({ ...options, where: { id: { lt: "5" } } });
	// @ts-expect-error Filters must name model fields.
	rows.deleteBatched({ ...options, where: { missing: 1 } });

	const versioned = yield* makeRepository(RetentionRow, {
		idColumn: "id",
		spanPrefix: "Retention",
		tableName: "retention",
		versionColumn: "version",
	});
	expectTypeOf(versioned.deleteBatched).toEqualTypeOf(rows.deleteBatched);
	const grouped = deleteGroupsBatched({
		batchSize: 10,
		delete: (value) => {
			expectTypeOf(value).toEqualTypeOf<string>();
			return Effect.fail("deletion" as const);
		},
		maxRows: 20,
		pause: 0,
		select: () =>
			Effect.gen(function* () {
				const value = yield* RetentionPrefix;
				if (value === "") {
					return yield* Effect.fail("selection" as const);
				}
				return [{ rowCount: 2, value }];
			}),
		tableName: "retention",
	});
	expectTypeOf<Effect.Success<typeof grouped>>().toEqualTypeOf<number>();
	expectTypeOf<Effect.Error<typeof grouped>>().toEqualTypeOf<SqlError | Schema.SchemaError | BatchedDeleteUnavailable | "selection" | "deletion">();
	expectTypeOf<Effect.Services<typeof grouped>>().toEqualTypeOf<RetentionPrefix | SqlClient.SqlClient | Reactivity.Reactivity>();
	const composite = yield* makeRepository(RetentionRow, { idColumn: ["id", "label"], spanPrefix: "Retention", tableName: "retention" });
	expectTypeOf(composite.deleteBatched).toEqualTypeOf(rows.deleteBatched);
});

it("retention purges retain model filters and grouped callback values, services and failures", () => {
	expectTypeOf(program).toBeObject();
});
