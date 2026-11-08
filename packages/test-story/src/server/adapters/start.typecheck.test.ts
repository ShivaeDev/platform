import { expectTypeOf } from "@effect/vitest";
import { Context, type Effect, type Scope } from "effect";
import type { Story } from "#server/storyKit.ts";
import { type Bakery, type BurntLoaf, bakery, hasDough } from "#test/bakery.ts";

class Missing extends Context.Service<Missing, string>()("@shivaedev/test-story/lifecycle/Missing") {}

const needsMissing = bakery.trait("pantry", "a missing service is needed", function* () {
	yield* Missing;
});

bakery.it("infers restarted verbs and retains trait service requirements", [], function* ({ story }) {
	expectTypeOf(story).toExtend<Story<Bakery, Effect.Effect<void, BurntLoaf>>>();
	const fresh = story.restart([]);
	expectTypeOf<Effect.Services<typeof fresh>>().toEqualTypeOf<Scope.Scope>();
	const restarted = yield* story.restart([hasDough(1)]);
	expectTypeOf(restarted.oven.loaves()).toEqualTypeOf<number>();
	expectTypeOf(story.apply([needsMissing])).toEqualTypeOf<Effect.Effect<void, unknown, Missing>>();
	expectTypeOf<Effect.Services<ReturnType<typeof story.restart<Missing>>>>().toEqualTypeOf<Missing | import("effect/Scope").Scope>();
});

// @ts-expect-error Applying a trait still needs its services from the kit's layer.
bakery.it("refuses a missing mid-story service", [], function* ({ story }) {
	yield* story.apply([needsMissing]);
});

// @ts-expect-error Restarting with a trait still needs its services from the kit's layer.
bakery.it("refuses a missing restarted service", [], function* ({ story }) {
	yield* story.restart([needsMissing]);
});
