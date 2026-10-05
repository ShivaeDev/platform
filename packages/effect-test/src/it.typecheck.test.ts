import { Context, Data, Effect, Scope } from "effect";
import { expectTypeOf } from "vitest";
import { it } from "#it.ts";

class Missing extends Context.Service<Missing, string>()("@types/Missing") {}

class Refused extends Data.TaggedError("Refused")<{ readonly reason: string }> {}

it.effect("infers what each yield produces", function* ({ task }) {
	expectTypeOf(task.name).toEqualTypeOf<string>();
	const count = yield* Effect.succeed(1);
	expectTypeOf(count).toEqualTypeOf<number>();
	const scope = yield* Scope.Scope;
	expectTypeOf(scope).toEqualTypeOf<Scope.Scope>();
});

it.effect("accepts any failure a test body yields", function* () {
	return yield* Effect.fail(new Refused({ reason: "typed" }));
});

it.live("accepts an effect body as well", () => Effect.succeed("done"));

// @ts-expect-error The test supplies no Missing service, so a body that needs it does not type-check.
it.effect("rejects an unmet requirement", function* () {
	return yield* Missing;
});

// @ts-expect-error The live tester supplies no Missing service either.
it.live("rejects an unmet requirement in an effect body", () => Missing.asEffect());

it.effect.each([{ id: 1 as const }])("keeps the table case type", function* (item) {
	expectTypeOf(item.id).toEqualTypeOf<1>();
	return yield* Effect.void;
});

it.effect.skipIf(false)("keeps the context type behind a condition", function* ({ task }) {
	expectTypeOf(task.name).toEqualTypeOf<string>();
	return yield* Effect.void;
});
