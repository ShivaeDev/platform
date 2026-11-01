import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpRouter } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { isTooManyRequests, TooManyRequests } from "@shivaedev/errors/taxonomy.ts";
import { type RateLimitOptions, rateLimit } from "#rateLimit.ts";
import { Store } from "#Store.ts";

const Api = RpcGroup.make(Rpc.make("admit", { error: TooManyRequests, success: Schema.Void }));

export const makeRpcLimiter = Effect.fnUntraced(function* (limit: RateLimitOptions) {
	const store = yield* Store;
	const handlers = Api.toLayer({
		admit: () => rateLimit(limit).pipe(Effect.catchTag("RateLimitStoreError", Effect.die)),
	});
	const app = HttpRouter.toWebHandler(
		RpcServer.layerHttp({ group: Api, path: "/rpc", protocol: "http" }).pipe(
			Layer.provide(handlers),
			Layer.provide(Layer.succeed(Store, store)),
			Layer.provide(RpcSerialization.layerJson),
		),
		{ disableLogger: true },
	);
	yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
	const protocol = RpcClient.layerProtocolHttp({ url: "http://localhost/rpc" }).pipe(
		Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
		Layer.provide(Layer.succeed(FetchHttpClient.Fetch, (input, init) => app.handler(new Request(input, init)))),
	);
	const client = yield* RpcClient.make(Api).pipe(Effect.provide(protocol));
	return () =>
		client.admit().pipe(
			Effect.as("admitted" as const),
			Effect.catchTag("TooManyRequests", (error) =>
				Effect.succeed({
					key: error.key,
					message: error.message,
					refusal: isTooManyRequests(error) ? "shared TooManyRequests" : "unexpected refusal",
					retryAt: error.retryAt,
				}),
			),
		);
});
