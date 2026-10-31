import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Key, KeyContext } from "@shivaedev/changes/keys.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { makeLiveServer } from "#makeLiveServer.ts";
import type { QueryRerun, QuerySubscription } from "#querySubscription.ts";

export const LiveServer = defineService({
	id: "@shivaedev/contract/LiveServer",
	initialize: makeLiveServer,
	methods: (server) => ({
		resync: () => server.resync,
		stream: (keys: readonly Key[], context?: KeyContext) => Effect.succeed(server.stream(keys, context)),
		subscribe: genericMethod(<E, R>(subscription: QuerySubscription<E, R>, context?: KeyContext, read?: QueryRerun<E, R>) =>
			Effect.succeed(read === undefined ? server.subscribe(subscription, context) : server.subscribe(subscription, context, read)),
		),
	}),
	requires: [Reactivity.Reactivity],
});
