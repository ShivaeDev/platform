import type { Server } from "node:http";
import { Effect } from "effect";

export const loopbackServer = Effect.fnUntraced(function* (server: Server, options: { readonly host?: string; readonly port?: number } = {}) {
	yield* Effect.acquireRelease(
		Effect.tryPromise(
			() =>
				new Promise<void>((resolve, reject) => {
					server.once("error", reject);
					server.listen(options.port ?? 0, options.host ?? "127.0.0.1", () => {
						server.off("error", reject);
						resolve();
					});
				}),
		),
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
		return yield* Effect.die("Missing loopback HTTP server address.\nhelp: The scoped HTTP server must be listening before reading its URL.");
	}
	return `http://127.0.0.1:${address.port}`;
});
