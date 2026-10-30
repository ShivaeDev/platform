import { connect, createServer, type Socket } from "node:net";
import { Effect } from "effect";

export const delayedPostgres = Effect.fn("DaemonTest.delayedPostgres")(function* (databaseUrl: string) {
	const target = new URL(databaseUrl);
	const sockets = new Set<Socket>();
	const server = createServer((incoming) => {
		const upstream = connect({ host: target.hostname, port: Number(target.port || 5432) });
		for (const socket of [incoming, upstream]) {
			sockets.add(socket);
			socket.on("close", () => sockets.delete(socket));
		}
		incoming.on("error", () => upstream.destroy());
		upstream.on("error", () => incoming.destroy());
		incoming.pipe(upstream).pipe(incoming);
	});
	function listen(port: number) {
		return Effect.promise(() => new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve)));
	}
	yield* Effect.addFinalizer(() =>
		Effect.promise(
			() =>
				new Promise<void>((resolve) => {
					for (const socket of sockets) {
						socket.destroy();
					}
					server.close(() => resolve());
				}),
		),
	);
	yield* listen(0);
	const address = server.address();
	if (address === null || typeof address === "string") {
		return yield* Effect.die("Expected a TCP PostgreSQL endpoint");
	}
	yield* Effect.promise(() => new Promise<void>((resolve) => server.close(() => resolve())));
	const url = new URL(databaseUrl);
	url.hostname = "127.0.0.1";
	url.port = String(address.port);
	url.searchParams.delete("host");
	url.searchParams.delete("port");
	return { start: () => listen(address.port), url: url.toString() };
});
