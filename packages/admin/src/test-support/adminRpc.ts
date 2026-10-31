import { Effect, Layer, Option, Ref } from "effect";
import { FetchHttpClient, HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { type Rpc, RpcClient, type RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import type { UserSessionShape } from "@shivaedev/identity/server/session.ts";
import { nodeHttpServer } from "@shivaedev/server/nodeHttpServer.ts";
import { JobsPermission, UsersPermission } from "#permissions.ts";
import { Access } from "./Access.ts";
import type { pages } from "./jobsPages.ts";

type Group = ReturnType<typeof pages>["group"];
export const adminRpc = Effect.fnUntraced(function* (group: Group, handlers: Layer.Layer<Rpc.ToHandler<RpcGroup.Rpcs<Group>>>) {
	const session = yield* Ref.make<Option.Option<UserSessionShape>>(Option.none());
	const policy = {
		origin: () => true,
		provider: { get: () => Ref.get(session) },
		roles: Access,
	};
	const auth = Layer.merge(permissionLayer(JobsPermission, policy), permissionLayer(UsersPermission, policy));
	const routes = RpcServer.layerHttp({ group, path: "/rpc", protocol: "http" }).pipe(Layer.provide([handlers, auth, RpcSerialization.layerJson]));
	const handler = yield* HttpRouter.toHttpEffect(routes);
	const context = yield* Layer.build(HttpServer.serve(handler).pipe(Layer.provideMerge(nodeHttpServer("127.0.0.1", { port: 0 }))));
	const { address } = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(address)) {
		throw new Error("The admin host must listen on TCP");
	}
	const baseUrl = `http://127.0.0.1:${address.port}`;
	const responses: string[] = [];
	const protocol = RpcClient.layerProtocolHttp({
		url: `${baseUrl}/rpc`,
	}).pipe(
		Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
		Layer.provide(
			Layer.succeed(FetchHttpClient.Fetch, async (input, init) => {
				const response = await fetch(input, init);
				responses.push(await response.clone().text());
				return response;
			}),
		),
	);
	const client = yield* RpcClient.make(group).pipe(Effect.provide(protocol));
	return { baseUrl, client, protocol, responses, session };
});
