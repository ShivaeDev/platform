import { createServer } from "node:http";
import { Effect } from "effect";
import { loopbackServer } from "@shivaedev/test-story/server/adapters/loopback.ts";

export type Reply = "status" | "length" | "chunked" | "schema" | "invalid" | "ok";

export const connections = Effect.gen(function* () {
	const ports: (number | undefined)[] = [];
	const closed: Promise<void>[] = [];
	const server = createServer((request, response) => {
		ports.push(request.socket.remotePort);
		const signal = Promise.withResolvers<void>();
		closed.push(signal.promise);
		request.socket.once("close", () => signal.resolve());
		const reply = request.url?.slice(1);
		response.writeHead(reply === "status" ? 404 : 200, {
			"content-type": "application/json",
			...(reply === "length" ? { "content-length": "1000" } : {}),
		});
		if (reply === "schema" || reply === "ok") {
			response.end(JSON.stringify({ name: reply === "schema" ? 12 : "paper" }));
		} else {
			response.flushHeaders();
			if (reply === "chunked") {
				response.write("abcdefghijklmnop");
			}
		}
	});
	const url = yield* loopbackServer(server);
	return { closed, ports, url };
});
