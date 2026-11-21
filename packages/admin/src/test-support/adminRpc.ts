import { Effect, Layer, Option, Ref, Schema } from "effect";
import { type Rpc, RpcClient, type RpcGroup, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import type { UserSessionShape } from "@shivaedev/identity/server/session.ts";
import { rpcSocketHost } from "@shivaedev/test-story/server/rpcSocketHost.ts";
import { Access } from "#test/Access.ts";
import type { pages } from "#test/jobsPages.ts";

type Group = RpcGroup.RpcGroup<RpcGroup.Rpcs<ReturnType<typeof pages>["pages"][number]["contract"]>>;

const isExit = Schema.decodeUnknownOption(Schema.Struct({ _tag: Schema.Literal("Exit"), requestId: Schema.Unknown }));
const isRequest = Schema.decodeUnknownOption(Schema.Struct({ _tag: Schema.Literal("Request"), id: Schema.Unknown, tag: Schema.String }));

// A live subscription's answer streams until the client leaves, so the wire readout keeps only the answers of requests that end.
function answersOnTheWire(answers: string[]): Layer.Layer<RpcSerialization.RpcSerialization> {
	const subscriptions = new Set<string>();
	return Layer.succeed(RpcSerialization.RpcSerialization, {
		...RpcSerialization.ndjson,
		makeUnsafe: () => {
			const parser = RpcSerialization.ndjson.makeUnsafe();
			return {
				decode: (data) => {
					const messages = parser.decode(data);
					for (const message of messages) {
						const exit = Option.getOrUndefined(isExit(message));
						if (exit !== undefined && !subscriptions.has(String(exit.requestId))) {
							answers.push(JSON.stringify(message));
						}
					}
					return messages;
				},
				encode: (message) => {
					const request = Option.getOrUndefined(isRequest(message));
					if (request?.tag.endsWith(".$changes")) {
						subscriptions.add(String(request.id));
					}
					return parser.encode(message);
				},
			};
		},
	});
}

export const adminRpc = Effect.fnUntraced(function* <R extends Rpc.Any, E>(
	group: Group,
	served: {
		readonly group: RpcGroup.RpcGroup<R>;
		readonly handlers: Layer.Layer<Rpc.ToHandler<R> | Rpc.Middleware<R>, E, SessionPolicy>;
	},
) {
	const session = yield* Ref.make<Option.Option<UserSessionShape>>(Option.none());
	const policy = {
		origin: () => true,
		provider: { get: () => Ref.get(session) },
		roles: Access,
	};
	const host = yield* rpcSocketHost(served.group, served.handlers.pipe(Layer.provide(Layer.succeed(SessionPolicy, policy))));
	const responses: string[] = [];
	const protocol = RpcClient.layerProtocolSocket().pipe(
		Layer.provide([
			Socket.layerWebSocket(host.url.replace(/^http/u, "ws")).pipe(Layer.provide(Socket.layerWebSocketConstructorGlobal)),
			answersOnTheWire(responses),
		]),
	);
	// A socket stays open for the engine's scope, so the client's protocol is built there rather than for one call.
	const client = yield* RpcClient.make(group).pipe(Effect.provideContext(yield* Layer.build(protocol)));
	return { client, host, protocol, responses, session };
});
