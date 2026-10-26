import { createServer } from "node:net";
import { Effect } from "effect";

export function supervisorPort(port: number) {
	if (port !== 0) {
		return Effect.succeed(port);
	}
	return Effect.tryPromise({
		catch: (cause) => new Error(`Cannot allocate a supervisor port: ${cause}`),
		try: () =>
			new Promise<number>((resolve, reject) => {
				const server = createServer();
				server.once("error", reject);
				server.listen(0, "127.0.0.1", () => {
					const address = server.address();
					server.close(() => (typeof address === "object" && address !== null ? resolve(address.port) : reject(new Error("Expected a TCP port"))));
				});
			}),
	});
}
