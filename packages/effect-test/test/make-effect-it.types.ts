import { Context, Effect, Layer } from "effect";
import { expectTypeOf } from "vitest";
import { eventually, makeEffectIt } from "../src/index.js";

class Token extends Context.Service<Token, string>()("@types/Token") {}

const { effectApp } = makeEffectIt({
	layer: Layer.succeed(Token, "typed"),
	around: (effect) => effect,
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
	harness.missing;
});

effectApp(
	"accepts a clock override",
	function* () {
		return yield* Token;
	},
	{ clock: "live" },
);

effectApp.each([{ id: 1 as const }])(
	"retains table case types",
	function* (item, harness) {
		expectTypeOf(item.id).toEqualTypeOf<1>();
		expectTypeOf(harness.token).toEqualTypeOf<string>();
		return yield* Effect.void;
	},
);
