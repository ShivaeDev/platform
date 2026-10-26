import { type ClientRequest, createServer, request } from "node:http";
import { Effect } from "effect";

export const stalledWatchProxy = Effect.fn("DaemonTest.stalledWatchProxy")(function* (port: number) {
	const subscribed = Promise.withResolvers<void>();
	const requests = new Set<ClientRequest>();
	const server = createServer((incoming, outgoing) => {
		const upstream = request({ headers: incoming.headers, hostname: "127.0.0.1", method: incoming.method, path: incoming.url, port }, (response) => {
			if (incoming.method === "POST") {
				// Hold the real RPC response while independent HTTP requests keep flowing.
				response.pause();
				subscribed.resolve();
				return;
			}
			outgoing.writeHead(response.statusCode ?? 502, response.headers);
			response.pipe(outgoing);
		});
		requests.add(upstream);
		upstream.on("close", () => requests.delete(upstream));
		upstream.on("error", () => outgoing.destroy());
		outgoing.on("close", () => upstream.destroy());
		incoming.pipe(upstream);
	});
	yield* Effect.addFinalizer(() =>
		Effect.promise(
			() =>
				new Promise<void>((resolve) => {
					for (const upstream of requests) {
						upstream.destroy();
					}
					server.closeAllConnections();
					server.close(() => resolve());
				}),
		),
	);
	yield* Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)));
	const address = server.address();
	if (address === null || typeof address === "string") {
		return yield* Effect.die("Expected a TCP proxy");
	}
	return { port: address.port, subscribed: Effect.promise(() => subscribed.promise) };
});
