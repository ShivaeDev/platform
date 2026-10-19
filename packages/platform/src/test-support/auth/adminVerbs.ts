import { Effect, Fiber, Layer, Queue, Stream } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { AdminApi } from "./adminApi.ts";
import type { AdminHost } from "./adminHost.ts";

export function adminVerbs(host: AdminHost, story: { tell: (line: string) => void }) {
	const protocol = Layer.suspend(() =>
		RpcClient.layerProtocolHttp({
			transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeaders(host.headers)),
			url: `${host.baseUrl}/rpc`,
		}),
	).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	const makeClient = RpcClient.make(AdminApi);
	function call<A, E>(use: (client: Effect.Success<typeof makeClient>) => Effect.Effect<A, E>) {
		return makeClient.pipe(Effect.flatMap(use), Effect.result, Effect.provide(protocol));
	}
	return {
		callAdminTools: Effect.fn("AuthStory.callAdminTools")(function* () {
			story.tell("call the admin-only RPC");
			return yield* call((client) => client.adminTools());
		}),
		callOwnerTools: Effect.fn("AuthStory.callOwnerTools")(function* () {
			story.tell("call the owner-only RPC");
			return yield* call((client) => client.ownerTools());
		}),
		followAdminFeed: Effect.fn("AuthStory.followAdminFeed")(function* () {
			story.tell("subscribe to the admin-only RPC stream");
			const received = yield* Queue.unbounded<string>();
			const fiber = yield* Effect.forkScoped(call((client) => Stream.runForEach(client.adminFeed(), (value) => Queue.offer(received, value))));
			return { ended: Fiber.join(fiber), next: Queue.take(received) };
		}),
		openAdminTools: Effect.fn("AuthStory.openAdminTools")(function* () {
			story.tell("open the admin-only HTTP route");
			const response = yield* Effect.promise(() => fetch(`${host.baseUrl}/admin-tools`, { headers: host.headers }));
			return { body: yield* Effect.promise(() => response.text()), status: response.status };
		}),
		profile: Effect.fn("AuthStory.profile")(function* () {
			story.tell("read the protected profile from the HTTP host");
			const response = yield* Effect.promise(() => fetch(`${host.baseUrl}/profile`, { headers: host.headers }));
			return { status: response.status, user: response.ok ? yield* Effect.promise(() => response.json()) : null };
		}),
		revokeSession: Effect.fn("AuthStory.revokeSession")(function* () {
			story.tell("revoke the minted session through Better Auth");
			yield* Effect.promise(() => host.auth.api.signOut({ headers: host.headers }));
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
