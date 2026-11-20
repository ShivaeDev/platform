import { Effect, Queue } from "effect";
import type { LiveHint } from "#live.ts";

// A subscription's hint also carries the sync tokens that arrived behind its keys; they never reach a hint stream's wire.
export type SubscriptionHint = LiveHint & { readonly synced?: readonly number[] };

function folded(pending: SubscriptionHint | undefined, hint: SubscriptionHint, count: number): SubscriptionHint {
	const ids = [...new Set([...(pending?.synced ?? []), ...(hint.synced ?? [])])];
	const synced = ids.length === 0 ? {} : { synced: ids };
	if (pending?._tag === "Resync" || hint._tag === "Resync" || count > 256) {
		return { _tag: "Resync", ...synced };
	}
	const keys = new Map([...(pending?.keys ?? []), ...hint.keys].map((key) => [JSON.stringify(key), key]));
	return { _tag: "Changed", keys: [...keys.values()], ...synced };
}

export const liveHintQueue = Effect.gen(function* () {
	const queue = yield* Queue.bounded<SubscriptionHint>(1);
	// The dispatcher offers synchronously, so a hint folds into the queued one before any fiber can take it.
	const offer = yield* Effect.sync(() => {
		let count = 0;
		return (hint: SubscriptionHint) => {
			const queued = Queue.takeUnsafe(queue);
			const pending = queued?._tag === "Success" ? queued.value : undefined;
			count = pending === undefined ? 1 : count + 1;
			Queue.offerUnsafe(queue, folded(pending, hint, count));
		};
	});
	return { offer, queue };
});
