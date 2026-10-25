import { Context, Effect, Layer } from "effect";
import { afterAll, expect } from "vitest";
import { storyKit } from "#storyKit.ts";
import { lazyVerbStory } from "#test/lazyVerbStory.ts";

class InitialCount extends Context.Service<InitialCount, number>()("effectHooks/InitialCount") {}

const INITIAL_COUNT = 2;
const INCREMENT = 1;
const MULTIPLIER = 2;
const events: string[] = [];
const kit = storyKit({
	after: {
		built: (engine) =>
			Effect.acquireRelease(
				Effect.sync(() => {
					engine.count *= MULTIPLIER;
					events.push("after");
				}),
				() => Effect.sync(() => events.push("after closed")),
			),
	},
	create: () =>
		Effect.acquireRelease(
			Effect.map(InitialCount, (count) => {
				events.push("create");
				return { count };
			}),
			() => Effect.sync(() => events.push("create closed")),
		),
	layer: Layer.succeed(InitialCount, INITIAL_COUNT),
	name: "effect hooks",
	stages: ["built"],
	verbs: (engine) => ({ count: () => engine.count }),
});

const incremented = kit.trait("built", "the count is incremented", (engine) =>
	Effect.acquireRelease(
		Effect.sync(() => {
			engine.count += INCREMENT;
			events.push("trait");
		}),
		() => Effect.sync(() => events.push("trait closed")),
	),
);

kit.it("runs Effect-returning creation, traits and after hooks in the story Scope", [incremented], ({ count }) => {
	expect(count()).toBe((INITIAL_COUNT + INCREMENT) * MULTIPLIER);
	expect(events).toEqual(["create", "trait", "after"]);
});

afterAll(() => {
	expect(events).toEqual(["create", "trait", "after", "after closed", "trait closed", "create closed"]);
});

lazyVerbStory.it("reads verb getters only when used and observes the current engine", [], (verbs) => {
	expect(verbs.getterReads()).toBe(0);
	const firstCount = 7;
	verbs.setCount(firstCount);
	expect(verbs.count).toBe(firstCount);
	const nextCount = 9;
	verbs.setCount(nextCount);
	expect(verbs.count).toBe(nextCount);
	expect(verbs.observedCounts()).toEqual([firstCount, nextCount]);
});
