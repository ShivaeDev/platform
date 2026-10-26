import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization, RpcTest } from "effect/rpc";
import { Authenticated } from "@shivaedev/identity/middleware.ts";

export const Ping = RpcGroup.make(Rpc.make("ping", { success: Schema.String }));
export const AuthenticatedPing = Ping.middleware(Authenticated);
export const pingHandlers = Ping.toLayer({ ping: () => Effect.succeed("pong") });

export function directPing() {
	return RpcTest.makeClient(Ping).pipe(
		Effect.flatMap((client) => client.ping()),
		Effect.provide(pingHandlers),
		Effect.scoped,
	);
}

export function ping(url: string, options: { readonly authenticated?: boolean } = {}) {
	const protocol = RpcClient.layerProtocolHttp({ url }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	const makeClient = options.authenticated ? RpcClient.make(AuthenticatedPing) : RpcClient.make(Ping);
	return Effect.runPromise(
		makeClient.pipe(
			Effect.flatMap((client) => client.ping()),
			Effect.provide(protocol),
			Effect.scoped,
		),
	);
}
