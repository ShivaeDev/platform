import { Context, Effect, Layer } from "effect";
import { afterAll, expect } from "vitest";
import { storyKit } from "#storyKit.ts";

class InitialCount extends Context.Service<InitialCount, number>()("effectHooks/InitialCount") {}

const events: string[] = [];
const kit = storyKit({
	after: {
		built: (engine) =>
			Effect.acquireRelease(
				Effect.sync(() => {
					engine.count *= 2;
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
	layer: Layer.succeed(InitialCount, 2),
	name: "effect hooks",
	stages: ["built"],
	verbs: (engine) => ({ count: () => engine.count }),
});

const incremented = kit.trait("built", "the count is incremented", (engine) =>
	Effect.acquireRelease(
		Effect.sync(() => {
			engine.count += 1;
			events.push("trait");
		}),
		() => Effect.sync(() => events.push("trait closed")),
	),
);

kit.it("runs Effect-returning creation, traits and after hooks in the story Scope", [incremented], ({ count }) => {
	expect(count()).toBe(6);
	expect(events).toEqual(["create", "trait", "after"]);
});

afterAll(() => {
	expect(events).toEqual(["create", "trait", "after", "after closed", "trait closed", "create closed"]);
});
