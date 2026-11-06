import { Effect, Stream } from "effect";
import { refreshSubscription } from "#adapters/refreshSubscription.ts";
import { compareQueries } from "#compareQueries.ts";
import type { LiveHint } from "#live.ts";
import type { QueryRerun, QuerySubscription } from "#querySubscription.ts";
import type { QueryUpdate, SubscriptionHint } from "#queryUpdate.ts";
import { QueryReadDenied } from "#readPolicyErrors.ts";
import { LiveServer } from "./service.ts";

function subscribeQueries<E, R, TRead extends QueryRerun<unknown, unknown> | undefined = undefined>(
	subscription: QuerySubscription<E, R>,
	read?: TRead & (QueryRerun<E, R> | undefined),
): Effect.Effect<
	Stream.Stream<TRead extends undefined ? SubscriptionHint : QueryUpdate, E | QueryReadDenied, R>,
	never,
	typeof LiveServer.Identifier
>;
function subscribeQueries<E, R>(subscription: QuerySubscription<E, R>, read?: QueryRerun<E, R>) {
	return Effect.fnUntraced(function* () {
		const server = yield* LiveServer;
		const hints = yield* server.register(subscription.keys);
		return hints.pipe(
			Stream.flatMap((registration) => {
				let scopes = subscription.scopes;
				let compare = compareQueries(subscription, read);
				const next = Effect.fnUntraced(function* (hint: LiveHint) {
					if (!(yield* subscription.authorized)) {
						compare = compareQueries(subscription, read, false);
						return [new QueryReadDenied({ message: "Read no longer allowed for subscribed queries" })];
					}
					const updates = yield* compare(hint, scopes);
					if (subscription.readScopes !== undefined) {
						scopes = yield* subscription.readScopes;
						registration.replaceKeys(scopes.flat());
					}
					return updates;
				});
				return registration.stream.pipe(
					Stream.mapEffect((hint) => refreshSubscription(subscription, next(hint))),
					Stream.flatMap(Stream.fromIterable),
				);
			}),
		);
	})();
}

export const subscribe = Effect.fn("LiveServer.subscribe")(subscribeQueries);
