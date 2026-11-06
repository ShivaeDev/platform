import { Context, Effect, Layer, Stream } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import { liveServerLayer } from "#live-server/layer.ts";
import { LiveServer } from "#live-server/service.ts";
import { subscribe as subscribeQueries } from "#live-server/subscribe.ts";
import type { QueryRerun, QuerySubscription } from "#querySubscription.ts";

export const standaloneLiveServer = Effect.gen(function* () {
	const context = yield* Effect.scoped(Layer.build(liveServerLayer));
	const server = Context.get(context, LiveServer);
	function subscribe<E, R>(subscription: QuerySubscription<E, R>, read: QueryRerun<E, R>) {
		return Stream.unwrap(Effect.provideContext(subscribeQueries(subscription, read), context));
	}
	return { resync: server.resync(), stream: (keys: readonly Key[]) => Stream.unwrap(server.stream(keys)), subscribe };
});
