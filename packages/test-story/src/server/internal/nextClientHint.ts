import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import type { ClientActivity } from "@shivaedev/contract/clientActivity.ts";

export const nextClientHint = Effect.fnUntraced(function* (activity: ClientActivity) {
	const before = (yield* activity.current).liveHints;
	return yield* activity.pipe(
		Stream.filter((state) => state.liveHints > before),
		Stream.take(1),
		Stream.runDrain,
	);
});
