import { type Agent, type ClientRequest, request } from "node:http";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";

export type Reply = Buffer | string;

export interface Exchange {
	readonly connection: string;
	readonly reply: Reply;
}

export interface Post {
	readonly chunks: readonly Uint8Array[];
	readonly contentLength?: number;
	readonly headers?: Readonly<Record<string, string>>;
	readonly tailAfterResponse?: Uint8Array;
}

export interface RouteState {
	readonly agent: Agent;
	readonly exchanges: Exchange[];
	readonly failures: { readonly _tag: string }[];
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
	const headers = { ...post.headers, ...(post.contentLength === undefined ? {} : { "content-length": post.contentLength }) };
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

export function exchange(state: RouteState, post: Post) {
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

export function sizes(chunks: readonly Uint8Array[]) {
	return chunks.map((chunk) => chunk.byteLength).join(" + ");
}
