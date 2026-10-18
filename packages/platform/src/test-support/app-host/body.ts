import { Agent } from "node:http";
import { ByteSize, Effect, Layer, Schema } from "effect";
import { HttpIncomingMessage, HttpRouter, HttpServerResponse } from "effect/http";
import { Rpc, RpcGroup } from "effect/rpc";
import { appHost } from "#server/appHost.ts";
import { readBoundedBody } from "#server/boundedBody.ts";
import { boundedRpcRequest } from "#server/boundedRpcRequest.ts";
import { sessions } from "./fixture.ts";
import { host } from "./story.ts";

const Echo = RpcGroup.make(Rpc.make("echo", { payload: { text: Schema.String }, success: Schema.String }));
export function message(text: string, id = "1") {
	return `${JSON.stringify({ _tag: "Request", headers: [], id, payload: { text }, tag: "echo" })}\n`;
}
export const echoRpc = host.trait("configured", "RPC records accepted NDJSON bodies", (state) => {
	state.build = () =>
		appHost({
			config: state.config,
			group: Echo,
			handlers: Echo.toLayer({
				echo: ({ text }) =>
					Effect.sync(() => {
						state.calls.push(text);
						return "accepted";
					}),
			}),
			services: Layer.empty,
			sessions: sessions(state.lookups),
		});
});
export const cachedBody = host.trait("configured", "the route reads bounded text and bytes repeatedly", (state) => {
	state.routes = HttpRouter.add("POST", "/body", (incoming) => {
		const bounded = boundedRpcRequest(incoming);
		return Effect.gen(function* () {
			const text = yield* bounded.text;
			const bytes = yield* bounded.arrayBuffer;
			return HttpServerResponse.text(`${text}\n${new TextDecoder().decode(bytes)}\n${yield* bounded.text}`);
		}).pipe(Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(128)));
	});
});
export const boundedBody = host.trait("configured", "the body route accepts eight bytes on a persistent connection", (state) => {
	state.routes = HttpRouter.add("POST", "/body", (incoming) =>
		Effect.gen(function* () {
			const body = yield* readBoundedBody(incoming);
			state.calls.push(Buffer.from(body));
			return HttpServerResponse.uint8Array(new Uint8Array(body));
		}).pipe(Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(8))),
	);
	state.agent = new Agent({ keepAlive: true, maxSockets: 1 });
	state.cleanup.push(() => {
		state.agent?.destroy();
	});
});
