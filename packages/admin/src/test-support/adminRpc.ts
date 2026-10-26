import { Effect, Layer, Option, Ref } from "effect";
import { FetchHttpClient, HttpRouter } from "effect/http";
import { type Rpc, RpcClient, type RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import type { UserSessionShape } from "@shivaedev/identity/server/session.ts";
import { AdminPermission } from "#permissions.ts";
import { Access } from "./Access.ts";
import type { pages } from "./jobsPages.ts";

type Group = ReturnType<typeof pages>["group"];
export const adminRpc = Effect.fnUntraced(function* (group: Group, handlers: Layer.Layer<Rpc.ToHandler<RpcGroup.Rpcs<Group>>>) {
	const session = yield* Ref.make<Option.Option<UserSessionShape>>(Option.none());
	const auth = permissionLayer(AdminPermission, {
		origin: () => true,
		provider: { get: () => Ref.get(session) },
		roles: Access,
	});
	const app = HttpRouter.toWebHandler(
		RpcServer.layerHttp({ group, path: "/rpc", protocol: "http" }).pipe(Layer.provide([handlers, auth, RpcSerialization.layerJson])),
		{ disableLogger: true },
	);
	yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
	const responses: string[] = [];
	const protocol = RpcClient.layerProtocolHttp({
		url: "http://localhost/rpc",
	}).pipe(
		Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
		Layer.provide(
			Layer.succeed(FetchHttpClient.Fetch, async (input, init) => {
				const response = await app.handler(new Request(input, init));
				responses.push(await response.clone().text());
				return response;
			}),
		),
	);
	const client = yield* RpcClient.make(group).pipe(Effect.provide(protocol));
	return { client, protocol, responses, session };
});
