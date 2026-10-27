import { Effect, Fiber, Layer, Queue, Stream } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { AdminApi } from "./adminApi.ts";
import type { AdminHost } from "./adminHost.ts";
import { adminRouteVerbs } from "./adminRouteVerbs.ts";
import { profileVerbs } from "./profileVerbs.ts";

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
		...profileVerbs(host, story),
		...adminRouteVerbs(host, story),
		callAdminTools: Effect.fn("AuthStory.callAdminTools")(function* () {
			story.tell("call the admin-only RPC");
			return yield* call((client) => client.adminTools());
		}),
		callOwnerTools: Effect.fn("AuthStory.callOwnerTools")(function* () {
			story.tell("call the owner-only RPC");
			return yield* call((client) => client.ownerTools());
		}),
		clientSession: Effect.fn("AuthStory.clientSession")(function* () {
			story.tell("read the client session through the auth HTTP endpoint");
			const response = yield* Effect.promise(() =>
				fetch(`${host.baseUrl}/api/auth/get-session`, {
					headers: host.headers,
				}),
			);
			return {
				payload: yield* Effect.promise(() => response.json()),
				status: response.status,
			};
		}),
		currentUserId: () => host.userId,
		followAdminFeed: Effect.fn("AuthStory.followAdminFeed")(function* () {
			story.tell("subscribe to the admin-only RPC stream");
			const received = yield* Queue.unbounded<string>();
			const fiber = yield* Effect.forkScoped(call((client) => Stream.runForEach(client.adminFeed(), (value) => Queue.offer(received, value))));
			return { ended: Fiber.join(fiber), next: Queue.take(received) };
		}),
		profile: Effect.fn("AuthStory.profile")(function* () {
			story.tell("read the protected profile from the HTTP host");
			const response = yield* Effect.promise(() => fetch(`${host.baseUrl}/profile`, { headers: host.headers }));
			return {
				status: response.status,
				user: response.ok ? yield* Effect.promise(() => response.json()) : null,
			};
		}),
		readRecord: (id: string) => {
			story.tell(`read record ${id} through the protected RPC`);
			return call((client) => client.readRecord({ id }));
		},
		revokeSession: Effect.fn("AuthStory.revokeSession")(function* () {
			story.tell("revoke the minted session through Better Auth");
			yield* Effect.promise(() => host.auth.api.signOut({ headers: host.headers }));
		}),
		setRole: Effect.fn("AuthStory.setRole")(function* (role: "admin" | "user") {
			story.tell(`an operator changes the current user's role to ${role}`);
			const sql = yield* SqlClient.SqlClient;
			yield* sql`update members set role = ${role} where id = ${host.userId}`;
		}),
	};
}
