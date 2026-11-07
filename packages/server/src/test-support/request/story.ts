import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Effect, Layer, Option, Stream } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { Api, openHost } from "#test/request/feature.ts";

export const requestStory = storyKit({
	clock: "test",
	*create() {
		const state = { builds: 0 };
		const host = yield* openHost(() => {
			state.builds += 1;
			return state.builds;
		});
		const context = yield* Layer.build(host);
		const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
		if (!NetAddress.isInetAddress(server.address)) {
			return yield* Effect.die("Expected TCP address");
		}
		return { state, url: `http://127.0.0.1:${server.address.port}/rpc` };
	},
	name: "request services over RPC",
	stages: [],
	verbs: ({ state, url }, story) => {
		function client(actor?: string, transport: "http" | "websocket" = "http") {
			const protocol =
				transport === "http"
					? RpcClient.layerProtocolHttp({
							transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeader("authorization", actor ?? "")),
							url,
						}).pipe(Layer.provide(FetchHttpClient.layer))
					: RpcClient.layerProtocolSocket().pipe(
							Layer.provide(layerWebSocket(url.replace(/^http/u, "ws"), { headers: { authorization: actor ?? "" } })),
						);
			return Effect.flatMap(Layer.build(protocol.pipe(Layer.provide(RpcSerialization.layerNdjson))), (context) =>
				RpcClient.make(Api).pipe(Effect.provideContext(context)),
			);
		}
		return {
			builds: () => Effect.sync(() => ({ global: state.builds })),
			connect: (actor: string, transport: "http" | "websocket") => {
				story.tell(`${actor} connects over ${transport}`);
				return Effect.map(client(actor, transport), (rpc) => ({
					read: (concurrent = false) => {
						story.tell(`${actor} reads their request service over ${transport}`);
						return rpc["request.read"]({ concurrent });
					},
				}));
			},
			read: (actor?: string) => {
				story.tell(`${actor ?? "a visitor"} reads their request service`);
				return client(actor).pipe(
					Effect.flatMap((rpc) => rpc["request.read"]({ concurrent: false })),
					answered,
				);
			},
			version: () => {
				story.tell("a visitor reads the host version");
				return client().pipe(Effect.flatMap((rpc) => rpc["platform.hostVersion.watch"]().pipe(Stream.runHead, Effect.map(Option.getOrThrow))));
			},
		};
	},
});
