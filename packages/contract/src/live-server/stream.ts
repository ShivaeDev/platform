import { Effect, Stream } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import { liveHintStream } from "#adapters/liveHintStream.ts";
import type { initialize } from "#live-server/initialize.ts";

export function stream(state: Effect.Success<typeof initialize>) {
	return Effect.fn("LiveServer.stream")(function* (keys: readonly Key[], syncClient?: string) {
		return (yield* liveHintStream(state, keys, syncClient)).pipe(Stream.flatMap((registration) => registration.stream));
	});
}
