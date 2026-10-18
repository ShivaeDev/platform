import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { SessionUser } from "@shivaedev/platform/rpc/identity.ts";
import { AuthenticatedUser } from "@shivaedev/platform/rpc/middleware.ts";

export const ProviderAccounts = RpcGroup.make(
	Rpc.make("providerAccounts", {
		success: Schema.Array(Schema.Struct({ accountId: Schema.String, providerId: Schema.String })),
	}),
).middleware(AuthenticatedUser);
export const providerAccountHandlers = ProviderAccounts.toLayer({
	providerAccounts: () => Effect.map(SessionUser, (user) => user.providerAccounts ?? []),
});

export function readProviderAccounts(baseUrl: string, fetch: typeof globalThis.fetch) {
	const protocol = RpcClient.layerProtocolHttp({
		transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeader("origin", baseUrl)),
		url: `${baseUrl}/rpc`,
	}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]), Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)));
	return Effect.gen(function* () {
		const client = yield* RpcClient.make(ProviderAccounts);
		return yield* client.providerAccounts();
	}).pipe(Effect.provide(protocol), Effect.scoped);
}
