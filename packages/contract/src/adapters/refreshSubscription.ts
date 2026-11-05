import { Effect } from "effect";
import type { QuerySubscription } from "#querySubscription.ts";

export function refreshSubscription<A, E, R>(subscription: QuerySubscription<E, R>, next: Effect.Effect<A, E, R>) {
	return Effect.flatMap(subscription.refresh ?? Effect.context<never>(), (current) => Effect.provideContext(next, current));
}
