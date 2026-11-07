import { Effect } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import { liveHintStream } from "#adapters/liveHintStream.ts";
import type { initialize } from "#live-server/initialize.ts";

export function register(state: Effect.Success<typeof initialize>) {
	return Effect.fn("LiveServer.register")(function* (keys: readonly Key[]) {
		return yield* liveHintStream(state, keys);
	});
}
