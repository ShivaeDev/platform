import { createServer } from "node:http";
import { Effect } from "effect";

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
	yield* Effect.acquireRelease(
		Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))),
		() =>
			Effect.promise(
				() =>
					new Promise<void>((resolve, reject) => {
						server.close((error) => (error ? reject(error) : resolve()));
						server.closeAllConnections();
					}),
			),
	);
	const address = server.address();
	if (address === null || typeof address === "string") {
		return yield* Effect.die("Expected a loopback TCP server");
	}
	return { closed, ports, url: `http://127.0.0.1:${address.port}` };
});
