import { once } from "node:events";
import { createServer, type RequestListener } from "node:http";
import { Effect } from "effect";

export const domHost = Effect.fnUntraced(function* (listener: RequestListener) {
	const server = yield* Effect.acquireRelease(
		Effect.sync(() => createServer(listener)),
		(listening) => Effect.promise(() => new Promise<void>((resolve, reject) => listening.close((error) => (error ? reject(error) : resolve())))),
	);
	yield* Effect.promise(async () => {
		server.listen(0, "127.0.0.1");
		await once(server, "listening");
	});
	const address = server.address();
	if (address === null || typeof address === "string") {
		return yield* Effect.die("DOM story host needs a TCP address");
	}
	return `http://localhost:${address.port}`;
});
