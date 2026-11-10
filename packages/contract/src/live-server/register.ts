import { Effect } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { initialize } from "#live-server/initialize.ts";
import { liveHintStream } from "#liveHintStream.ts";

export function register(state: Effect.Success<typeof initialize>) {
	return Effect.fn("LiveServer.register")(function* (keys: readonly Key[]) {
		return yield* liveHintStream(state, keys);
	});
}
