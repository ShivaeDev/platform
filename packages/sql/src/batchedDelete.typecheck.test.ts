import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import type { SqlError } from "effect/sql/SqlError";
import { expectTypeOf, it } from "vitest";
import type { BatchedDeleteUnavailable } from "#batchedDelete.ts";
import { makeRepository } from "#repository.ts";

class RetentionPrefix extends Context.Service<RetentionPrefix, string>()("RetentionPrefix") {}
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
	const composite = yield* makeRepository(RetentionRow, { idColumn: ["id", "label"], spanPrefix: "Retention", tableName: "retention" });
	expectTypeOf(composite.deleteBatched).toEqualTypeOf(rows.deleteBatched);
});

it("retention purges retain model filter types, codec services and typed failures for every repository", () => {
	expectTypeOf(program).toBeObject();
});
