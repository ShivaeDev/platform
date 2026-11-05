import { Effect, Queue } from "effect";
import type { LiveHint } from "#live.ts";

export const liveHintQueue = Effect.gen(function* () {
	const queue = yield* Queue.bounded<LiveHint>(256);
	let overflowed = false;
	function offer(hint: LiveHint) {
		if (overflowed && Queue.sizeUnsafe(queue) > 0) {
			return;
		}
		overflowed = false;
		if (Queue.offerUnsafe(queue, hint)) {
			return;
		}
		while (Queue.takeUnsafe(queue) !== undefined) {
			// Overflow discards targeted hints because the resync covers every subscribed read.
		}
		overflowed = true;
		Queue.offerUnsafe(queue, { _tag: "Resync" });
	}
	return { offer, queue };
});
