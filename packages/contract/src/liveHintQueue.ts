import { Effect, Queue } from "effect";
import type { LiveHint } from "#live.ts";

// A subscription's hint also carries the sync tokens that arrived behind its keys; they never reach a hint stream's wire.
export type SubscriptionHint = LiveHint & { readonly synced?: readonly number[] };

export const liveHintQueue = Effect.gen(function* () {
	const queue = yield* Queue.bounded<SubscriptionHint>(1);
	let count = 0;
	function offer(hint: SubscriptionHint) {
		const queued = Queue.takeUnsafe(queue);
		const pending = queued?._tag === "Success" ? queued.value : undefined;
		count = pending === undefined ? 1 : count + 1;
		const ids = [...new Set([...(pending?.synced ?? []), ...(hint.synced ?? [])])];
		const synced = ids.length === 0 ? {} : { synced: ids };
		if (pending?._tag === "Resync" || hint._tag === "Resync" || count > 256) {
			Queue.offerUnsafe(queue, { _tag: "Resync", ...synced });
			return;
		}
		const keys = new Map([...(pending?.keys ?? []), ...hint.keys].map((key) => [JSON.stringify(key), key]));
		Queue.offerUnsafe(queue, { _tag: "Changed", keys: [...keys.values()], ...synced });
	}
	return { offer, queue };
});
