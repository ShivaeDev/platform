import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { AdminApi } from "./adminApi.ts";
import type { AdminHost } from "./adminHost.ts";

export function adminVerbs(host: AdminHost, story: { tell: (line: string) => void }) {
	return {
		callAdminTools: Effect.fn("AuthStory.callAdminTools")(function* () {
			story.tell("call the admin-only RPC handler");
			const protocol = RpcClient.layerProtocolHttp({
				transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders(host.headers)),
				url: `${host.baseUrl}/rpc`,
			}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
			return yield* RpcClient.make(AdminApi).pipe(
				Effect.flatMap((client) => client.adminTools()),
				Effect.result,
				Effect.provide(protocol),
			);
		}),
		openAdminTools: Effect.fn("AuthStory.openAdminTools")(function* () {
			story.tell("open the admin-only HTTP route");
			const response = yield* Effect.promise(() => fetch(`${host.baseUrl}/admin-tools`, { headers: host.headers }));
			return { body: yield* Effect.promise(() => response.text()), status: response.status };
		}),
		setRole: Effect.fn("AuthStory.setRole")(function* (role: "admin" | "user") {
			story.tell(`an operator changes the current user's role to ${role}`);
			const { test } = yield* Effect.promise(() => host.auth.$context);
			const operator = yield* Effect.promise(() =>
				host.auth.api.createUser({ body: { email: "operator@example.test", name: "Operator", role: "admin" } }),
			);
			const headers = yield* Effect.promise(() => test.getAuthHeaders({ userId: operator.user.id }));
			yield* Effect.tryPromise(() => host.auth.api.setRole({ body: { role, userId: host.userId }, headers }));
		}),
	};
}
