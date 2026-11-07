import { createConnection, createServer, type Socket } from "node:net";
import { Effect } from "effect";

export const settingsEndpoint = Effect.fnUntraced(function* (destination: string, source: "authority" | "parameters") {
	const url = new URL(destination);
	if (url.port !== "55432") {
		yield* Effect.acquireRelease(
			Effect.promise(async () => {
				const sockets = new Set<Socket>();
				const server = createServer((client) => {
					const upstream = createConnection({ host: url.hostname, port: Number(url.port || 5432) });
					for (const socket of [client, upstream]) {
						sockets.add(socket);
						socket.on("close", () => sockets.delete(socket));
						socket.on("error", () => {
							client.destroy();
							upstream.destroy();
						});
					}
					client.pipe(upstream).pipe(client);
				});
				await new Promise<void>((resolve, reject) => {
					server.once("error", reject);
					server.listen(55_432, "127.0.0.1", resolve);
				});
				return {
					close: async () => {
						for (const socket of sockets) {
							socket.destroy();
						}
						await new Promise<void>((resolve) => server.close(() => resolve()));
					},
				};
			}),
			(server) => Effect.promise(server.close),
		);
	}
	const local = new URL(destination);
	local.hostname = "127.0.0.1";
	local.port = "55432";
	if (source === "parameters") {
		local.searchParams.set("host", local.hostname);
		local.searchParams.set("port", local.port);
		local.hostname = "unused.invalid";
		local.port = "1";
	}
	return local.toString();
});
