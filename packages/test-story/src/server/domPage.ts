import * as Effect from "effect/Effect";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { pageFetch } from "#internal/adapters/pageFetch.ts";

export const domPage = Effect.fn("BrowserStory.domPage")(function* (url: string) {
	const pending = yield* SubscriptionRef.make(false);
	yield* Effect.acquireRelease(
		Effect.sync(() => pageFetch(url, (busy) => SubscriptionRef.set(pending, busy))),
		(restore) => Effect.sync(restore),
	);
	return { pending: SubscriptionRef.changes(pending) };
});
