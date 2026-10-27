import { Context, Effect, Layer } from "effect";
import { expectTypeOf } from "vitest";
import { eventually } from "#eventually.ts";
import { makeEffectIt } from "#makeEffectIt.ts";

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

const scoped = makeEffectIt({
	around: (effect) =>
		Effect.gen(function* () {
			yield* Effect.addFinalizer(() => Effect.void);
			return yield* effect;
		}),
	layer: Layer.empty,
	makeHarness: () => Effect.acquireRelease(Effect.succeed("scoped"), () => Effect.void),
});
scoped.effectApp("accepts scoped bodies", function* () {
	yield* Effect.addFinalizer(() => Effect.void);
});
scoped.effectApp.each([1, 2])("accepts scoped table bodies %s", function* () {
	yield* Effect.addFinalizer(() => Effect.void);
});
makeEffectIt({
	layer: Layer.empty,
	// @ts-expect-error Scope cannot satisfy an unrelated harness requirement.
	makeHarness: () => Effect.service(Token),
});
makeEffectIt({
	// @ts-expect-error Scope cannot satisfy an unrelated wrapper requirement.
	around: (effect) => Effect.flatMap(Token, () => effect),
	layer: Layer.empty,
	makeHarness: () => Effect.void,
});

effectApp("retains harness, context and service types for Effect-returning bodies", (harness, context) => {
	expectTypeOf(harness.token).toEqualTypeOf<string>();
	expectTypeOf(context.task.name).toEqualTypeOf<string>();
	return Effect.service(Token);
});

effectApp.each([{ id: 1 as const }])("retains Effect-returning table case types", (item, harness) => {
	expectTypeOf(item.id).toEqualTypeOf<1>();
	expectTypeOf(harness.token).toEqualTypeOf<string>();
	return Effect.service(Token);
});

// @ts-expect-error Effect-returning bodies cannot require services absent from the Layer.
empty.effectApp("refuses missing services in an Effect-returning body", () => Effect.service(Token));

// @ts-expect-error Effect-returning table bodies cannot require services absent from the Layer.
empty.effectApp.each([1])("refuses missing services in an Effect-returning table body", () => Effect.service(Token));
