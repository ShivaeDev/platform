import { Context, Effect, Layer } from "effect";
import { expectTypeOf } from "vitest";
import { type StoryKit, storyKit } from "#storyKit.ts";

class Missing extends Context.Service<Missing, string>()("scope/Missing") {}

const scoped = storyKit({
	after: {
		*built() {
			yield* Effect.addFinalizer(() => Effect.void);
		},
	},
	around: (effect) => effect.pipe(Effect.ensuring(Effect.void)),
	*create() {
		return yield* Effect.acquireRelease(Effect.succeed({ open: true }), () => Effect.void);
	},
	name: "scoped",
	run: {
		*diagnose() {
			yield* Effect.addFinalizer(() => Effect.void);
			return "waiting";
		},
		*failed() {
			yield* Effect.addFinalizer(() => Effect.void);
			return undefined;
		},
		maxSteps: 1,
		*step() {
			yield* Effect.addFinalizer(() => Effect.void);
		},
	},
	stages: ["built"],
	verbs: () => ({}),
});

scoped.it(
	"accepts scoped traits and bodies without a worker Scope",
	[
		scoped.trait("built", "a resource is open", function* () {
			yield* Effect.addFinalizer(() => Effect.void);
		}),
	],
	function* () {
		yield* Effect.addFinalizer(() => Effect.void);
	},
);

expectTypeOf(scoped).toMatchTypeOf<StoryKit<{ open: boolean }, "built", object, Effect.Effect<unknown, unknown, unknown>, never>>();

// @ts-expect-error Scope does not supply unrelated services to a body.
scoped.it("refuses a missing service", [], function* () {
	yield* Missing;
});
const missingTrait = scoped.trait("built", "needs a service", function* () {
	yield* Missing;
});
// @ts-expect-error Scope does not supply unrelated services to a trait.
scoped.it("refuses a missing trait service", [missingTrait]);

storyKit({
	// @ts-expect-error A wrapper cannot add a service unavailable from the worker Layer.
	around: (effect) => Effect.flatMap(Missing, () => effect),
	create: () => ({}),
	layer: Layer.empty,
	name: "missing wrapper service",
	stages: ["built"],
	verbs: () => ({}),
});

storyKit({
	// @ts-expect-error A wrapper alone cannot invent a worker service without a Layer.
	around: (effect) => Effect.flatMap(Missing, () => effect),
	create: () => ({}),
	name: "missing layer",
	stages: ["built"],
	verbs: () => ({}),
});

// @ts-expect-error Scoped creation still needs a Layer for an unrelated service.
storyKit({
	*create() {
		yield* Effect.addFinalizer(() => Effect.void);
		return yield* Missing;
	},
	name: "missing creation service",
	stages: ["built"],
	verbs: () => ({}),
});
// @ts-expect-error Scoped after hooks still need a Layer for an unrelated service.
storyKit({
	after: {
		*built() {
			yield* Effect.addFinalizer(() => Effect.void);
			yield* Missing;
		},
	},
	create: () => ({}),
	name: "missing after service",
	stages: ["built"],
	verbs: () => ({}),
});
// @ts-expect-error Scoped run hooks still need a Layer for an unrelated service.
storyKit({
	create: () => ({}),
	name: "missing run service",
	run: {
		maxSteps: 1,
		*step() {
			yield* Effect.addFinalizer(() => Effect.void);
			yield* Missing;
		},
	},
	stages: ["built"],
	verbs: () => ({}),
});
