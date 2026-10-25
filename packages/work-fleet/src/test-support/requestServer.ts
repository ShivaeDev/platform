import { createServer } from "node:http";
import { Effect } from "effect";

export const requestServer = Effect.fn("DaemonTest.requestServer")(function* (status?: number) {
	const received: { method: string | undefined; url: string | undefined }[] = [];
	const server = createServer((request, response) => {
		received.push({ method: request.method, url: request.url });
		request.resume();
		if (status !== undefined) {
			response.writeHead(status).end("Daemon failed");
		}
	});
	yield* Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)));
	const close = Effect.promise(
		() =>
			new Promise<void>((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			}),
	);
	yield* Effect.addFinalizer(() => close);
	const address = server.address();
	if (address === null || typeof address === "string") {
		return yield* Effect.die("Expected a TCP server");
	}
	return { close, port: address.port, received: () => [...received], requests: () => received.length };
});
