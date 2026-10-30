import { Agent, createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { ByteSize, Effect, Layer } from "effect";
import { HttpIncomingMessage, HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { RequestBodyTooLarge, readBoundedBody } from "#server/boundedBody.ts";
import { exchange, type RouteState, sizes } from "./transport.ts";

function failureOf(error: { readonly _tag: string }) {
	return error instanceof RequestBodyTooLarge ? `request body over ${error.limit} bytes` : `unexpected failure: ${error._tag}`;
}

export const requestBody = storyKit({
	after: {
		*route(state) {
			const limit = state.limit;
			const routes = HttpRouter.add("POST", "/body", (incoming) =>
				readBoundedBody(incoming).pipe(
					Effect.map((body) => HttpServerResponse.uint8Array(new Uint8Array(body))),
					Effect.tapError((error) => Effect.sync(() => state.failures.push(error))),
					limit === undefined ? (effect) => effect : Effect.provideService(HttpIncomingMessage.MaxBodySize, ByteSize.bytes(limit)),
				),
			);
			const context = yield* Layer.build(
				HttpRouter.serve(routes, { disableLogger: true }).pipe(
					Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
				),
			);
			const server = yield* HttpServer.HttpServer.pipe(Effect.provide(context));
			if (!NetAddress.isInetAddress(server.address)) {
				return yield* Effect.die("Expected a TCP server");
			}
			state.url = `http://${NetAddress.formatIp(server.address.address)}:${server.address.port}/body`;
		},
	},
	clock: "live",
	*create() {
		const agent = new Agent({ keepAlive: true, maxSockets: 1 });
		yield* Effect.addFinalizer(() => Effect.sync(() => agent.destroy()));
		const state: RouteState = { agent, exchanges: [], failures: [], limit: undefined, ports: [], url: "" };
		return state;
	},
	inspect: ({ exchanges, failures, limit, url }) => ({
		exchanges: exchanges.map(({ connection, reply }) => ({ connection, reply: typeof reply === "string" ? reply : reply.toString("hex") })),
		failures,
		limit,
		url,
	}),
	name: "bounded request body route",
	stages: ["route", "client"],
	verbs: (state, story) => ({
		client: {
			declaresLength: (contentLength: number) => {
				story.tell(`the client POSTs with content-length ${contentLength} and holds the body back`);
				return exchange(state, { chunks: [], contentLength });
			},
			exchanges: () => Effect.sync(() => [...state.exchanges]),
			postsChunked: (...chunks: readonly Uint8Array[]) => {
				story.tell(`the client POSTs ${sizes(chunks)} bytes chunked`);
				return exchange(state, { chunks });
			},
			postsWithCredentials: (body: Uint8Array) => {
				story.tell("the client POSTs with cookies and an authorization header");
				return exchange(state, { chunks: [body], headers: { authorization: "Bearer private-token", cookie: "session=private-session" } });
			},
			postsWithLength: (body: Uint8Array) => {
				story.tell(`the client POSTs ${body.byteLength} bytes with content-length ${body.byteLength}`);
				return exchange(state, { chunks: [body], contentLength: body.byteLength });
			},
		},
		route: {
			failures: () => Effect.sync(() => state.failures.map(failureOf)),
			recordedFailures: () => Effect.sync(() => [...state.failures]),
		},
	}),
});

export function routeEchoesUpTo(bytes: number) {
	return requestBody.trait("route", `the route echoes bodies of up to ${bytes} bytes to a client that keeps one connection alive`, (state) => {
		state.limit = bytes;
	});
}

export const refusedChunkedBodyLeavesUnreadTail = requestBody.trait(
	"client",
	"the client POSTs 4 + 5 bytes chunked and, after the refusal, finishes that body with an 11-byte tail the route never reads",
	(state) => exchange(state, { chunks: [Buffer.alloc(4), Buffer.alloc(5)], tailAfterResponse: Buffer.from("unread tail") }),
);
