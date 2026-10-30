import { Context, Effect, Layer } from "effect";
import { storyKit } from "#storyKit.ts";
import { noteLifetime } from "./lifetimeLog.ts";

class InitialCount extends Context.Service<InitialCount, number>()("effectHooks/InitialCount") {}

export const INITIAL_COUNT = 2;
export const INCREMENT = 1;
export const MULTIPLIER = 2;

function opened<A>(event: string, open: Effect.Effect<A, never, InitialCount>) {
	return Effect.acquireRelease(
		Effect.tap(open, () => noteLifetime(event)),
		() => noteLifetime(`${event} closed`),
	);
}

export const counter = storyKit({
	after: {
		built: (engine) =>
			opened(
				"after",
				Effect.sync(() => {
					engine.count *= MULTIPLIER;
				}),
			),
	},
	create: () =>
		opened(
			"create",
			Effect.map(InitialCount, (count) => ({ count })),
		),
	layer: Layer.succeed(InitialCount, INITIAL_COUNT),
	name: "effect hooks",
	stages: ["built"],
	verbs: (engine) => ({ count: () => engine.count }),
});

export const incremented = counter.trait("built", "the count is incremented", (engine) =>
	opened(
		"trait",
		Effect.sync(() => {
			engine.count += INCREMENT;
		}),
	),
);
