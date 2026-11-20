import { Clock, Effect, Layer, Option, Ref } from "effect";
import { FetchHttpClient, HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { type Rpc, RpcClient, type RpcGroup, RpcSerialization, RpcServer } from "effect/rpc";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import type { UserSessionShape } from "@shivaedev/identity/server/session.ts";
import { nodeHttpServer } from "@shivaedev/server/adapters/nodeHttpServer.ts";
import { Access } from "#test/Access.ts";
import type { pages } from "#test/jobsPages.ts";

type Group = ReturnType<typeof pages>["group"];

// A live subscription's answer streams until the client leaves, so the wire readout keeps only answers that end.
function subscribes(init: RequestInit | undefined) {
	const body = init?.body;
	const text = body instanceof Uint8Array ? new TextDecoder().decode(body) : String(body ?? "");
	return text.includes('.$changes"');
}
export const adminRpc = Effect.fnUntraced(function* <R extends Rpc.Any, E>(
	group: Group,
	served: {
		readonly group: RpcGroup.RpcGroup<R>;
		readonly handlers: Layer.Layer<Rpc.ToHandler<R> | Rpc.Middleware<R>, E, SessionPolicy>;
	},
) {
	const clock = yield* Clock.Clock;
	const session = yield* Ref.make<Option.Option<UserSessionShape>>(Option.none());
	const policy = {
		origin: () => true,
		provider: { get: () => Ref.get(session) },
		roles: Access,
	};
	const registered = served.handlers.pipe(Layer.provide(Layer.succeed(SessionPolicy, policy)));
	const routes = RpcServer.layerHttp({ group: served.group, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([registered, RpcSerialization.layerNdjson]),
	);
	const handler = yield* HttpRouter.toHttpEffect(routes);
	const context = yield* Layer.build(
		HttpServer.serve(handler).pipe(
			Layer.provideMerge(nodeHttpServer("127.0.0.1", { port: 0 })),
			Layer.provideMerge(Layer.succeed(Clock.Clock, clock)),
		),
	);
	const { address } = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(address)) {
		throw new Error("The admin host must listen on TCP");
	}
	const baseUrl = `http://127.0.0.1:${address.port}`;
	const responses: string[] = [];
	const protocol = RpcClient.layerProtocolHttp({
		url: `${baseUrl}/rpc`,
	}).pipe(
		Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
		Layer.provide(
			Layer.succeed(FetchHttpClient.Fetch, async (input, init) => {
				const response = await fetch(input, init);
				if (!subscribes(init)) {
					responses.push(await response.clone().text());
				}
				return response;
			}),
		),
	);
	const client = yield* RpcClient.make(group).pipe(Effect.provide(protocol));
	return { baseUrl, client, protocol, responses, session };
});
