import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { storyKit } from "#storyKit.ts";

const events: string[] = [];
const kit = storyKit({
	after: {
		*built() {
			events.push("after");
			yield* Effect.addFinalizer(() => Effect.sync(() => events.push("after closed")));
		},
	},
	around: (effect) =>
		Effect.gen(function* () {
			events.push("enter");
			return yield* effect;
		}).pipe(Effect.ensuring(Effect.sync(() => events.push("exit")))),
	clock: "live",
	*create() {
		events.push("create");
		return yield* Effect.acquireRelease(Effect.succeed({}), () => Effect.sync(() => events.push("engine closed")));
	},
	name: "lifetime",
	stages: ["built"],
	verbs: () => ({}),
});
const resource = kit.trait("built", "a scoped resource is acquired", function* () {
	events.push("trait");
	yield* Effect.addFinalizer(() => Effect.sync(() => events.push("trait closed")));
});
kit.it.fails("closes resources after a failed story", [resource], function* () {
	events.push("body");
	expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
	yield* Effect.fail("intentional failure");
});
kit.it("wraps creation, seeding and body and closes scoped resources", [], function* () {
	expect(events.slice(0, 9)).toEqual(["enter", "create", "trait", "after", "body", "exit", "after closed", "trait closed", "engine closed"]);
	expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
});
kit.it(
	"a story can override a live kit with TestClock",
	[],
	function* () {
		expect(yield* Clock.currentTimeMillis).toBe(0);
	},
	{ clock: "test" },
);
