import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { AuthUnavailable, Unauthorized } from "@shivaedev/platform/errors/taxonomy.ts";
import { Identity, SessionUserWithProviderAccounts } from "@shivaedev/platform/rpc/identity.ts";
import { AuthenticatedUserWithProviderAccounts } from "@shivaedev/platform/rpc/middleware.ts";

export const ProviderAccounts = RpcGroup.make(
	Rpc.make("identityOnly", { success: Schema.String }),
	Rpc.make("providerAccounts", {
		error: Schema.Union([AuthUnavailable, Unauthorized]),
		success: Schema.Array(Schema.Struct({ accountId: Schema.String, providerId: Schema.String })),
	}),
).middleware(AuthenticatedUserWithProviderAccounts);
export const providerAccountHandlers = ProviderAccounts.toLayer({
	identityOnly: () => Effect.map(Identity, (identity) => identity.id),
	providerAccounts: () =>
		Effect.gen(function* () {
			const user = yield* SessionUserWithProviderAccounts;
			const [accounts] = yield* Effect.all([user.providerAccounts, user.providerAccounts], { concurrency: "unbounded" });
			return accounts;
		}),
});

export function readProviderAccounts(
	baseUrl: string,
	fetch: typeof globalThis.fetch,
	operation: "identityOnly" | "providerAccounts" = "providerAccounts",
) {
	const protocol = RpcClient.layerProtocolHttp({
		transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeader("origin", baseUrl)),
		url: `${baseUrl}/rpc`,
	}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]), Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)));
	return Effect.gen(function* () {
		const client = yield* RpcClient.make(ProviderAccounts);
		return yield* operation === "identityOnly" ? client.identityOnly() : client.providerAccounts();
	}).pipe(Effect.provide(protocol), Effect.scoped);
}
