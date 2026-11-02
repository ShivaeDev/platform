import { Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { Identity } from "@shivaedev/identity/identity.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";

export const BrowserApi = RpcGroup.make(Rpc.make("browserIdentity", { success: Schema.String })).middleware(Authenticated);
export const browserHandlers = BrowserApi.toLayer({ browserIdentity: () => Effect.map(Identity, ({ id }) => id) });

export function browserIdentity(baseUrl: string, headers: Readonly<Record<string, string>>) {
	return RpcClient.make(BrowserApi).pipe(
		Effect.flatMap((client) => client.browserIdentity()),
		Effect.provide(
			RpcClient.layerProtocolHttp({
				transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeaders(headers)),
				url: `${baseUrl}/rpc`,
			}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
		),
		Effect.catchTag("Unauthorized", () => Effect.succeed("unauthorized")),
	);
}
