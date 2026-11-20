import { Effect, Stream } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { initialize } from "#live-server/initialize.ts";
import { liveHintStream } from "#liveHintStream.ts";

export function stream(state: Effect.Success<typeof initialize>) {
	return Effect.fn("LiveServer.stream")(function* (keys: readonly Key[], syncClient?: string) {
		return (yield* liveHintStream(state, keys, syncClient)).pipe(Stream.flatMap((registration) => registration.stream));
	});
}
