import { Deferred, Effect, SubscriptionRef } from "effect";
import { activityPageClient } from "#test/activityPageView.ts";

export const createSettlingApp = Effect.fn("Story.createSettlingApp")(function* (url: string) {
	const preview = yield* Deferred.make<void>();
	const previewed = yield* Deferred.make<void>();
	const attached = yield* Deferred.make<void>();
	const pending = yield* SubscriptionRef.make(false);
	return { attached, client: activityPageClient(url), pending, preview, previewed };
});
