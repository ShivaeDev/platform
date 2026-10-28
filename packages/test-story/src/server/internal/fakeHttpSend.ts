import type { ServerResponse } from "node:http";
import * as HttpStatus from "effect/http/HttpStatus";
import type { FakeHttpFault, FakeHttpReply } from "#fakeHttpService.ts";

export function fakeHttpConnection(response: ServerResponse) {
	const closed = new Promise<undefined>((resolve) => response.once("close", () => resolve(undefined)));
	return {
		closed,
		pause: async (pending: Promise<void> | undefined) => {
			if (pending !== undefined) {
				await Promise.race([pending, closed]);
			}
		},
	};
}

async function sendChunks(response: ServerResponse, chunks: NonNullable<FakeHttpReply["chunks"]>, closed: Promise<undefined>) {
	const iterator = Symbol.asyncIterator in chunks ? chunks[Symbol.asyncIterator]() : chunks[Symbol.iterator]();
	try {
		while (!(response.destroyed || response.writableEnded)) {
			const next = await Promise.race([iterator.next(), closed]);
			if (!next || next.done) {
				break;
			}
			await new Promise<void>((resolve, reject) => response.write(next.value, (error) => (error ? reject(error) : resolve())));
		}
	} finally {
		void Promise.resolve(iterator.return?.()).catch(() => response.destroy());
	}
}

function replyBody(body: unknown) {
	if (body instanceof Uint8Array || body === undefined) {
		return body;
	}
	return JSON.stringify(body);
}

export async function fakeHttpSend(response: ServerResponse, reply: FakeHttpReply, pause?: () => Promise<void>) {
	if (response.destroyed || response.writableEnded) {
		return;
	}
	const connection = fakeHttpConnection(response);
	const body = replyBody(reply.body);
	response.writeHead(reply.status ?? HttpStatus.fromLiteral("OK"), { "content-type": "application/json", ...reply.headers });
	if (pause) {
		response.flushHeaders();
		await connection.pause(pause());
	}
	if (reply.chunks) {
		await sendChunks(response, reply.chunks, connection.closed);
	}
	if (!(response.destroyed || response.writableEnded)) {
		response.end(body);
	}
}

export async function fakeHttpStrike(response: ServerResponse, fault: Exclude<FakeHttpFault, { kind: "status" }>, reply: FakeHttpReply = {}) {
	if (fault.kind === "reset") {
		response.writeHead(reply.status ?? HttpStatus.fromLiteral("OK"), { "content-type": "application/json", ...reply.headers });
		response.flushHeaders();
		await new Promise<void>((resolve) => response.write("", () => resolve()));
	}
	response.destroy();
}
