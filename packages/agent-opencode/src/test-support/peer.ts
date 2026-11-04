import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Effect, Queue } from "effect";

function sessionProperties(session: string, type: string, properties: Readonly<Record<string, unknown>>) {
	let field: string | undefined;
	if (type === "message.updated") {
		field = "info";
	}
	if (type === "message.part.updated") {
		field = "part";
	}
	const nested = field === undefined ? undefined : properties[field];
	if (field !== undefined && typeof nested === "object" && nested !== null) {
		return { ...properties, [field]: { ...nested, "sessionID": session } };
	}
	return { ...properties, "sessionID": session };
}

export interface RequestRecord {
	readonly body: unknown;
	readonly directory: string | null;
	readonly method: string;
	readonly path: string;
}
export const scriptedPeer = Effect.gen(function* () {
	const requests = yield* Queue.unbounded<RequestRecord>();
	const streams = new Set<ServerResponse>();
	let nextSession = 0;
	let promptResponse: "accept" | "drop" | "refuse" = "accept";
	const configurations = yield* Queue.unbounded<string>();
	function reply(url: URL, method: string | undefined, data: string, response: ServerResponse) {
		response.setHeader("content-type", "application/json");
		if (url.pathname === "/peer/config") {
			Queue.offerUnsafe(configurations, data);
			response.end("{}");
		} else if (url.pathname === "/session") {
			nextSession += 1;
			response.end(JSON.stringify({ directory: "/project", id: `session-${nextSession}` }));
		} else if (url.pathname === "/config/providers") {
			response.end(
				JSON.stringify({
					default: { acme: "fast" },
					providers: [{ id: "acme", models: { fast: { id: "fast", name: "Fast", variants: { careful: {} } } } }],
				}),
			);
		} else if (method === "GET") {
			response.end(JSON.stringify({ directory: "/project", id: url.pathname.split("/").at(-1) }));
		} else {
			response.statusCode = 204;
			response.end();
		}
	}
	function refusePrompt(request: IncomingMessage, response: ServerResponse): boolean {
		if (promptResponse === "drop") {
			request.socket.destroy();
			return true;
		}
		if (promptResponse === "refuse") {
			response.writeHead(400, { "content-type": "application/json" });
			response.end('{"error":"refused"}');
			return true;
		}
		return false;
	}

	const server = createServer(async (request, response) => {
		const address = new URL(request.url ?? "/", "http://localhost");
		if (address.pathname === "/global/event") {
			response.writeHead(200, { "content-type": "text/event-stream" });
			response.write(": connected\n\n");
			streams.add(response);
			response.on("close", () => streams.delete(response));
			return;
		}
		let data = "";
		for await (const chunk of request) {
			data += chunk;
		}
		const body: unknown = data === "" ? undefined : JSON.parse(data);
		Queue.offerUnsafe(requests, { body, directory: address.searchParams.get("directory"), method: request.method ?? "GET", path: address.pathname });
		if (address.pathname.endsWith("/prompt_async") && refusePrompt(request, response)) {
			return;
		}
		reply(address, request.method, data, response);
	});
	yield* Effect.acquireRelease(
		Effect.promise(async () => {
			server.listen(0, "127.0.0.1");
			await once(server, "listening");
		}),
		() =>
			Effect.promise(async () => {
				for (const stream of streams) {
					stream.end();
				}
				server.closeAllConnections();
				await new Promise<void>((resolve) => server.close(() => resolve()));
			}),
	);
	const address = server.address();
	if (address === null || typeof address === "string") {
		return yield* Effect.die("peer has no TCP address");
	}
	return {
		closeEvents: () =>
			Effect.sync(() => {
				for (const stream of streams) {
					stream.end();
				}
			}),
		configuration: Queue.take(configurations),
		emit: (session: string, type: string, properties: Readonly<Record<string, unknown>> = {}) =>
			Effect.sync(() => {
				const scoped = sessionProperties(session, type, properties);
				const frame = JSON.stringify({ payload: { properties: scoped, type } });
				for (const stream of streams) {
					stream.write(`data: ${frame}\n\n`);
				}
			}),
		promptResponse: (mode: "accept" | "drop" | "refuse") => {
			promptResponse = mode;
		},
		request: Queue.take(requests),
		url: `http://127.0.0.1:${address.port}`,
	};
});
