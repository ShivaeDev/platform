import { Effect, type Stream } from "effect";
import type { makeLiveServer } from "#makeLiveServer.ts";
import type { QueryRerun, QuerySubscription } from "#querySubscription.ts";
import type { QueryUpdate, SubscriptionHint } from "#queryUpdate.ts";
import type { QueryReadDenied } from "#readPolicyErrors.ts";

export function subscribe(server: Effect.Success<typeof makeLiveServer>) {
	function subscribeToQueries<E, R, TRead extends QueryRerun<unknown, unknown> | undefined = undefined>(
		subscription: QuerySubscription<E, R>,
		read?: TRead & (QueryRerun<E, R> | undefined),
	): Effect.Effect<Stream.Stream<TRead extends undefined ? SubscriptionHint : QueryUpdate, E | QueryReadDenied, R>>;
	function subscribeToQueries<E, R>(subscription: QuerySubscription<E, R>, read?: QueryRerun<E, R>) {
		return Effect.succeed(read === undefined ? server.subscribe(subscription) : server.subscribe(subscription, read));
	}
	return subscribeToQueries;
}
