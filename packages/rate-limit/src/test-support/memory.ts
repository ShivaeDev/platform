import { Effect, Layer } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { memoryStore } from "#memoryStore.ts";
import { makeLimiter } from "./makeLimiter.ts";

export const memory = storyKit({
	around: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.provide(effect, Layer.fresh(memoryStore)),
	create: () => makeLimiter,
	layer: memoryStore,
	name: "memory rate limits",
	stages: [],
	verbs: (engine) => engine,
});
