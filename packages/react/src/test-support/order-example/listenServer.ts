import { createServer, type IncomingHttpHeaders, type IncomingMessage } from "node:http";
import * as HttpStatus from "effect/http/HttpStatus";
import type { orderWebHandler } from "./runtime.ts";

function toHeaders(incoming: IncomingHttpHeaders): Headers {
	const headers = new Headers();
	for (const [name, value] of Object.entries(incoming)) {
		for (const item of Array.isArray(value) ? value : [value]) {
			if (item !== undefined) {
				headers.append(name, item);
			}
		}
	}
	return headers;
}

async function toRequest(incoming: IncomingMessage, signal: AbortSignal): Promise<Request> {
	const chunks: Buffer[] = [];
	for await (const chunk of incoming) {
		chunks.push(Buffer.from(chunk));
	}
	return new Request(`http://127.0.0.1${incoming.url}`, {
		headers: toHeaders(incoming.headers),
		method: incoming.method ?? "GET",
		signal,
		...(chunks.length > 0 ? { body: Buffer.concat(chunks) } : {}),
	});
}

export async function listenServer(app: ReturnType<typeof orderWebHandler>) {
	const server = createServer(async (incoming, outgoing) => {
		const controller = new AbortController();
		function abort() {
			if (!outgoing.writableFinished) {
				controller.abort();
			}
		}
		incoming.once("aborted", abort);
		outgoing.once("close", abort);
		try {
			const response = await app.handler(await toRequest(incoming, controller.signal));
			if (outgoing.destroyed) {
				return;
			}
			outgoing.writeHead(response.status, Object.fromEntries(response.headers));
			outgoing.end(Buffer.from(await response.arrayBuffer()));
		} catch (error) {
			if (outgoing.destroyed) {
				return;
			}
			outgoing.writeHead(HttpStatus.fromLiteral("InternalServerError"));
			outgoing.end(String(error));
		} finally {
			incoming.off("aborted", abort);
			outgoing.off("close", abort);
		}
	});
	try {
		await new Promise<void>((resolve, reject) => {
			server.once("error", reject);
			server.listen(0, "127.0.0.1", resolve);
		});
	} catch (error) {
		await app.dispose();
		throw error;
	}
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected a loopback TCP listener");
	}
	return {
		close: async () => {
			try {
				await new Promise<void>((resolve, reject) => {
					server.close((error) => (error ? reject(error) : resolve()));
					server.closeIdleConnections();
				});
			} finally {
				await app.dispose();
			}
		},
		url: `http://127.0.0.1:${address.port}/rpc`,
	};
}
