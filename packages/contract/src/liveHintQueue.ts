import { Effect, Queue } from "effect";
import type { LiveHint } from "#live.ts";

export const liveHintQueue = Effect.gen(function* () {
	const queue = yield* Queue.bounded<LiveHint>(1);
	let count = 0;
	function offer(hint: LiveHint) {
		const queued = Queue.takeUnsafe(queue);
		const pending = queued?._tag === "Success" ? queued.value : undefined;
		count = pending === undefined ? 1 : count + 1;
		if (pending?._tag === "Resync" || hint._tag === "Resync" || count > 256) {
			Queue.offerUnsafe(queue, { _tag: "Resync" });
			return;
		}
		const keys = new Map([...(pending?.keys ?? []), ...hint.keys].map((key) => [JSON.stringify(key), key]));
		Queue.offerUnsafe(queue, { _tag: "Changed", keys: [...keys.values()] });
	}
	return { offer, queue };
});
