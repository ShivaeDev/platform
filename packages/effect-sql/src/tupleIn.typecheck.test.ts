import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import type { SqlClient } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import { makeRepository } from "#repository.ts";
import { tupleIn } from "#tupleIn.ts";

class Encoding extends Context.Service<Encoding, string>()("TupleEncoding") {}
const RunId = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transform((value: string) => value),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(Encoding, (prefix) => prefix + value)),
	}),
);
class Run extends Model.Class<Run>("TupleRun")({ attempt: Schema.NumberFromString, id: Schema.Int, runId: RunId }) {}

const program = Effect.gen(function* () {
	const runs = yield* makeRepository(Run, { idColumn: "id", spanPrefix: "Run", tableName: "runs" });
	const where = { ...tupleIn(Run, ["runId", "attempt"], [["one", 1]]), id: { in: [1, 2] } };
	const found = runs.findMany({ select: ["id"], where });
	expectTypeOf<Effect.Success<typeof found>>().toEqualTypeOf<Array<{ readonly id: number }>>();
	expectTypeOf<Effect.Services<typeof found>>().toEqualTypeOf<Encoding>();
	const selected = runs.select({ select: ["attempt"], where });
	expectTypeOf<Effect.Services<typeof selected.statement>>().toEqualTypeOf<Encoding>();
	const deleted = runs.delete(where);
	expectTypeOf<Effect.Success<typeof deleted>>().toEqualTypeOf<void>();
	expectTypeOf<Effect.Services<typeof deleted>>().toEqualTypeOf<Encoding>();
	runs.findMany({ where: tupleIn(Run, ["id", "runId", "attempt"], [[1, "one", 2]]) });
	runs.select({ where: tupleIn(Run, ["runId", "attempt"], []) });
	const fields = ["runId", "attempt"] as const;
	const values = [
		["one", 1],
		["two", 2],
	] as const;
	runs.delete(tupleIn(Run, fields, values));
	// @ts-expect-error Tuple columns must name model fields.
	tupleIn(Run, ["missing", "attempt"], [["one", 1]]);
	// @ts-expect-error Every tuple position uses its decoded field type.
	tupleIn(Run, ["runId", "attempt"], [[1, "one"]]);
	// @ts-expect-error Encoded numeric strings are not decoded numbers.
	tupleIn(Run, ["runId", "attempt"], [["one", "1"]]);
	// @ts-expect-error Each tuple must have every selected field.
	tupleIn(Run, ["runId", "attempt"], [["one"]]);
	// @ts-expect-error Each tuple must have exactly the selected fields.
	tupleIn(Run, ["runId", "attempt"], [["one", 1, 2]]);
	// @ts-expect-error Tuple lists cover at least two fields.
	tupleIn(Run, ["runId"], [["one"]]);
	tupleIn(
		Run,
		["runId", "attempt"],
		[
			["one", 1],
			// @ts-expect-error A valid first tuple does not widen later tuple positions.
			[2, "two"],
		],
	);
});

it("tuple filters check model columns and decoded positions while retaining encoding services", () => {
	expectTypeOf(program).toEqualTypeOf<Effect.Effect<void, never, SqlClient.SqlClient>>();
});
