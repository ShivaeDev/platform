import { Effect, Random } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeLiveServer } from "#makeLiveServer.ts";

const runtimeRandomEngine = Effect.gen(function* () {
	const reactivity = yield* Reactivity.make;
	const invalidated: Reactivity.KeysInput[] = [];
	const observed: Reactivity.Reactivity = {
		...reactivity,
		invalidateUnsafe: (keys) => {
			invalidated.push(keys);
			reactivity.invalidateUnsafe(keys);
		},
	};
	const server = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, observed), Random.withSeed("contract-live"));
	return { invalidated, server };
});

export const runtimeRandom = storyKit({
	create: () => runtimeRandomEngine,
	name: "live server runtime random",
	stages: ["server"],
	verbs: ({ invalidated, server }, story) => ({
		invalidatedKeys: () => [...invalidated],
		resync: () => {
			story.tell("the server requests a resync using its runtime-generated identity");
			return server.resync;
		},
	}),
});
