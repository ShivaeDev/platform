import { Effect, Fiber, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { LiveHint } from "#live.ts";
import { makeLiveServer } from "#makeLiveServer.ts";

export const liveStreams = storyKit({
	clock: "live",
	create: () => makeLiveServer,
	inspect: () => ({}),
	layer: Reactivity.layer,
	name: "live stream count",
	stages: [],
	verbs: (server) => ({
		open: () =>
			Effect.gen(function* () {
				const hints: LiveHint[] = [];
				const fiber = yield* server.stream([]).pipe(
					Stream.runForEach((hint) => Effect.sync(() => hints.push(hint))),
					Effect.forkScoped,
				);
				return { close: Fiber.interrupt(fiber), hints };
			}),
		resync: () => server.resync,
	}),
});
