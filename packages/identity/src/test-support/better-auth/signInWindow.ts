import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { rateLimitStorage } from "#server/better-auth/adapters/rateLimitStorage.ts";

export const signInWindow = storyKit({
	*create() {
		return yield* rateLimitStorage.pipe(Effect.provide(memoryStore));
	},
	name: "sign-in window through the host store",
	stages: [],
	verbs: (storage, story) => ({
		request: () => {
			story.tell("alice attempts a sign-in with a budget of two per ten seconds");
			return Effect.promise(() => storage.consume("alice", { max: 2, window: 10 }));
		},
		timePasses: (millis: number) => {
			story.tell(`${millis} milliseconds pass`);
			return TestClock.adjust(millis);
		},
	}),
});
