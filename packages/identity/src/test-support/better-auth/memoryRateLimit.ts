import { type Duration, Effect, Exit, Scope } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { memoryRateLimit } from "#server/better-auth/memoryRateLimit.ts";

export const buckets = storyKit({
	*create() {
		const scope = yield* Scope.make();
		yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
		return { scope, storage: yield* memoryRateLimit.pipe(Scope.provide(scope)) };
	},
	name: "auth memory rate-limit buckets",
	stages: ["configured"],
	verbs: (engine, story) => ({
		advance: (duration: Duration.Input) => {
			story.tell(`time advances by ${duration}`);
			return TestClock.adjust(duration);
		},
		close: () => {
			story.tell("the owner scope closes");
			return Scope.close(engine.scope, Exit.void);
		},
		consume: (key: string, rule = { max: 2, window: 10 }) => {
			story.tell(`a request consumes the bucket ${key}`);
			return Effect.promise(() => engine.storage.consume(key, rule));
		},
	}),
});

export const atCapacity = buckets.trait("configured", "100,000 distinct client buckets have been consumed", (engine) =>
	Effect.promise(async () => {
		for (let index = 0; index < 100_000; index += 1) {
			await engine.storage.consume(`client-${index}`, { max: 1, window: 60 });
		}
	}),
);
