import { Context, Effect, Layer } from "effect";
import { expectTypeOf } from "vitest";
import { eventually } from "#eventually.ts";
import { makeEffectIt } from "#vitest.ts";

class Token extends Context.Service<Token, string>()("@types/Token") {}

const { effectApp } = makeEffectIt({
	around: (effect) => effect,
	layer: Layer.succeed(Token, "typed"),
	makeHarness: () => Effect.map(Token, (token) => ({ token })),
});

effectApp("retains harness and Layer types", function* (harness, context) {
	expectTypeOf(harness.token).toEqualTypeOf<string>();
	expectTypeOf(context.task.name).toEqualTypeOf<string>();
	const token = yield* Token;
	expectTypeOf(token).toEqualTypeOf<string>();
	const later = yield* eventually(Effect.succeed(token), {
		interval: "1 millis",
		times: 1,
	});
	expectTypeOf(later).toEqualTypeOf<string>();

	// @ts-expect-error Custom harnesses do not widen unknown properties.
	void harness.missing;
});

effectApp(
	"accepts a clock override",
	function* () {
		return yield* Token;
	},
	{ clock: "live" },
);

effectApp.each([{ id: 1 as const }])("retains table case types", function* (item, harness) {
	expectTypeOf(item.id).toEqualTypeOf<1>();
	expectTypeOf(harness.token).toEqualTypeOf<string>();
	return yield* Effect.void;
});

const empty = makeEffectIt({ layer: Layer.empty, makeHarness: () => Effect.succeed({ shelf: 0 }) });

empty.effectApp("takes a Layer that provides nothing", function* (harness) {
	expectTypeOf(harness.shelf).toEqualTypeOf<number>();
	return yield* Effect.void;
});

// @ts-expect-error A Layer that provides nothing provides no Token.
empty.effectApp("refuses a service the empty Layer does not provide", function* () {
	return yield* Token;
});
