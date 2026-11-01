import { Effect, Schema } from "effect";
import type * as AtomRef from "effect/reactivity/AtomRef";
import { expectTypeOf } from "vitest";
import { form } from "#form.ts";

const fields = form(
	Schema.Struct({
		profile: Schema.Struct({ details: Schema.Struct({ count: Schema.NumberFromString }) }),
		teams: Schema.Array(Schema.Struct({ scores: Schema.Array(Schema.Number) })),
	}),
	{
		initialValues: { profile: { details: { count: "1" } }, teams: [{ scores: [10] }] },
		onSubmit: Effect.succeed,
	},
);

const count = fields.field("profile").prop("details").prop("count");
expectTypeOf(count).toEqualTypeOf<AtomRef.AtomRef<string>>();
expectTypeOf(count.value).toEqualTypeOf<string>();
// @ts-expect-error Nested refs hold encoded input values.
count.set(2);
// @ts-expect-error Nested property names must exist.
fields.field("profile").prop("missing");

const score = fields.field("teams").prop(0).prop("scores").prop(0);
expectTypeOf(score).toEqualTypeOf<AtomRef.AtomRef<number>>();
expectTypeOf(score.value).toEqualTypeOf<number>();
// @ts-expect-error Array element refs keep their numeric value type.
score.set("2");
