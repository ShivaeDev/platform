import { Agent, type ClientRequest, createServer, request } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { ByteSize, Effect, Layer } from "effect";
import { HttpIncomingMessage, HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import * as NetAddress from "effect/net/NetAddress";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { RequestBodyTooLarge, readBoundedBody } from "#server/boundedBody.ts";

type Reply = Buffer | string;

interface Exchange {
	readonly connection: string;
	readonly reply: Reply;
}

interface Post {
	readonly chunks: readonly Uint8Array[];
	readonly contentLength?: number;
	readonly tailAfterResponse?: Uint8Array;
}

interface RouteState {
	readonly agent: Agent;
	readonly exchanges: Exchange[];
	readonly failures: string[];
	limit: number | undefined;
	readonly ports: (number | undefined)[];
	url: string;
}

function replyOf(status: number, body: Buffer): Reply {
	if (status === HttpStatus.fromLiteral("OK")) {
		return body;
	}
	return status === HttpStatus.fromLiteral("PayloadTooLarge") ? "413 Payload Too Large" : `HTTP ${status}`;
}

function failureOf(error: { readonly _tag: string }) {
	return error instanceof RequestBodyTooLarge ? `request body over ${error.limit} bytes` : `unexpected failure: ${error._tag}`;
}

function finishBody(outgoing: ClientRequest, { tailAfterResponse }: Post, withheld: boolean) {
	if (tailAfterResponse !== undefined) {
		outgoing.end(tailAfterResponse);
	} else if (withheld) {
		outgoing.destroy();
	}
}

function sendPost(state: RouteState, post: Post): Promise<{ readonly port: number | undefined; readonly reply: Reply }> {
	const withheld = post.chunks.length === 0 && post.contentLength !== undefined;
	const { promise, reject, resolve } = Promise.withResolvers<{ readonly port: number | undefined; readonly reply: Reply }>();
	const headers = post.contentLength === undefined ? {} : { "content-length": post.contentLength };
	const outgoing = request(state.url, { agent: state.agent, headers, method: "POST" }, (response) => {
		const received: Buffer[] = [];
		response.on("data", (chunk: Buffer) => received.push(chunk));
		response.on("end", () => {
			finishBody(outgoing, post, withheld);
			resolve({ port: outgoing.socket?.localPort, reply: replyOf(response.statusCode ?? 0, Buffer.concat(received)) });
		});
	});
	outgoing.on("error", reject);
	for (const chunk of post.chunks) {
		outgoing.write(chunk);
	}
	if (post.tailAfterResponse !== undefined || withheld) {
		outgoing.flushHeaders();
	} else {
		outgoing.end();
	}
	return promise;
}

function exchange(state: RouteState, post: Post) {
	return Effect.promise(() => sendPost(state, post)).pipe(
		Effect.map(({ port, reply }) => {
			if (!state.ports.includes(port)) {
				state.ports.push(port);
			}
			state.exchanges.push({ connection: `connection ${state.ports.indexOf(port) + 1}`, reply });
			return reply;
		}),
	);
}

function sizes(chunks: readonly Uint8Array[]) {
	return chunks.map((chunk) => chunk.byteLength).join(" + ");
}

export const requestBody = storyKit({
	after: {
		*route(state) {
			const limit = state.limit;
			const routes = HttpRouter.add("POST", "/body", (incoming) =>
				readBoundedBody(incoming).pipe(
					Effect.map((body) => HttpServerResponse.uint8Array(new Uint8Array(body))),
					Effect.tapError((error) => Effect.sync(() => state.failures.push(failureOf(error)))),
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
			postsWithLength: (body: Uint8Array) => {
				story.tell(`the client POSTs ${body.byteLength} bytes with content-length ${body.byteLength}`);
				return exchange(state, { chunks: [body], contentLength: body.byteLength });
			},
		},
		route: {
			failures: () => Effect.sync(() => [...state.failures]),
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
