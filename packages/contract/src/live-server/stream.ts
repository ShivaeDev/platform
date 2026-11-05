import { Effect, Stream } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import { liveHintStream } from "#adapters/liveHintStream.ts";
import type { initialize } from "./initialize.ts";

export function stream(state: Effect.Success<typeof initialize>) {
	return Effect.fn("LiveServer.stream")(function* (keys: readonly Key[]) {
		return (yield* liveHintStream(state, keys)).pipe(Stream.flatMap((registration) => registration.stream));
	});
}
