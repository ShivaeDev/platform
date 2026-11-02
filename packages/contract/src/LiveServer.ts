import { Effect, type Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Key } from "@shivaedev/changes/keys.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import type { QueryRerun, QuerySubscription } from "#querySubscription.ts";
import type { QueryUpdate, SubscriptionHint } from "#queryUpdate.ts";
import type { QueryReadDenied } from "#readPolicyErrors.ts";

export const LiveServer = defineService({
	id: "@shivaedev/contract/LiveServer",
	initialize: makeLiveServer,
	methods: (server) => {
		function subscribe<E, R, TRead extends QueryRerun<unknown, unknown> | undefined = undefined>(
			subscription: QuerySubscription<E, R>,
			read?: TRead & (QueryRerun<E, R> | undefined),
		): Effect.Effect<Stream.Stream<TRead extends undefined ? SubscriptionHint : QueryUpdate, E | QueryReadDenied, R>>;
		function subscribe<E, R>(subscription: QuerySubscription<E, R>, read?: QueryRerun<E, R>) {
			return Effect.succeed(read === undefined ? server.subscribe(subscription) : server.subscribe(subscription, read));
		}
		return {
			resync: () => server.resync,
			stream: (keys: readonly Key[]) => Effect.succeed(server.stream(keys)),
			subscribe: genericMethod(subscribe),
		};
	},
	requires: [Reactivity.Reactivity],
});
