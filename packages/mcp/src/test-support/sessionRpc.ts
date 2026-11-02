import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { Identity } from "@shivaedev/identity/identity.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";

export const SessionRpc = RpcGroup.make(Rpc.make("sessionIdentity", { success: Schema.String })).middleware(Authenticated);
export const sessionHandlers = SessionRpc.toLayer({ sessionIdentity: () => Effect.map(Identity, ({ id }) => id) });

export function sessionIdentity(baseUrl: string, headers: Record<string, string>) {
	return RpcClient.make(SessionRpc).pipe(
		Effect.flatMap((client) => client.sessionIdentity()),
		Effect.provide(
			RpcClient.layerProtocolHttp({
				transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders(headers)),
				url: `${baseUrl}/rpc`,
			}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
		),
		Effect.catchTag("Unauthorized", () => Effect.succeed("unauthorized")),
	);
}
