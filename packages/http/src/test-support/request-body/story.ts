import { Agent, type ClientRequest, createServer, request } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { ByteSize, Effect, Layer } from "effect";
import { HttpIncomingMessage, HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readBoundedBody } from "#server/boundedBody.ts";

interface Posted {
	readonly body: Buffer;
	readonly clientPort: number | undefined;
	readonly status: number;
}
interface PostOptions {
	readonly contentLength?: number;
	readonly tailAfterResponse?: Uint8Array;
}

interface RouteState {
	readonly agent: Agent;
	readonly bodiesRead: Buffer[];
	readonly failures: string[];
	limit: number | undefined;
	url: string;
}

function finishBody(outgoing: ClientRequest, tailAfterResponse: Uint8Array | undefined, withheld: boolean) {
	if (tailAfterResponse !== undefined) {
		outgoing.end(tailAfterResponse);
	} else if (withheld) {
		outgoing.destroy();
	}
}

function sendPost(url: string, agent: Agent, chunks: readonly Uint8Array[], { contentLength, tailAfterResponse }: PostOptions): Promise<Posted> {
	const withheld = chunks.length === 0 && contentLength !== undefined;
	const { promise, reject, resolve } = Promise.withResolvers<Posted>();
	const headers = contentLength === undefined ? {} : { "content-length": contentLength };
	const outgoing = request(url, { agent, headers, method: "POST" }, (response) => {
		const received: Buffer[] = [];
		response.on("data", (chunk: Buffer) => received.push(chunk));
		response.on("end", () => {
			finishBody(outgoing, tailAfterResponse, withheld);
			resolve({ body: Buffer.concat(received), clientPort: outgoing.socket?.localPort, status: response.statusCode ?? 0 });
		});
	});
	outgoing.on("error", reject);
	for (const chunk of chunks) {
		outgoing.write(chunk);
	}
	if (tailAfterResponse !== undefined || withheld) {
		outgoing.flushHeaders();
	} else {
		outgoing.end();
	}
	return promise;
}

export const requestBody = storyKit({
	after: {
		*route(state) {
			const limit = state.limit;
			const routes = HttpRouter.add("POST", "/body", (incoming) =>
				Effect.gen(function* () {
					const body = yield* readBoundedBody(incoming);
					state.bodiesRead.push(Buffer.from(body));
					return HttpServerResponse.uint8Array(new Uint8Array(body));
				}).pipe(
					Effect.tapError((error) => Effect.sync(() => state.failures.push(error._tag))),
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
		const state: RouteState = { agent, bodiesRead: [], failures: [], limit: undefined, url: "" };
		return state;
	},
	inspect: ({ bodiesRead, failures, limit, url }) => ({ bodiesRead: bodiesRead.map((body) => body.toString("hex")), failures, limit, url }),
	name: "bounded request body route",
	stages: ["route"],
	verbs: (state, story) => ({
		client: {
			posts: (chunks: readonly Uint8Array[], options: PostOptions = {}) => {
				const sizes = chunks.map((chunk) => chunk.byteLength).join(" + ") || "no";
				const framing = options.contentLength === undefined ? "chunked" : `content-length ${options.contentLength}`;
				const tail = options.tailAfterResponse === undefined ? "" : " and finishes the body after the response";
				story.tell(`the client POSTs ${sizes} bytes, ${framing}${tail}`);
				return Effect.promise(() => sendPost(state.url, state.agent, chunks, options));
			},
		},
		route: {
			bodiesRead: () => state.bodiesRead,
			failures: () => state.failures,
		},
	}),
});

export function routeAccepts(bytes: number) {
	return requestBody.trait("route", `the route reads bodies of up to ${bytes} bytes on a keep-alive connection`, (state) => {
		state.limit = bytes;
	});
}
