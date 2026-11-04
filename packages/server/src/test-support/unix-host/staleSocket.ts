import { renameSync } from "node:fs";
import { createServer } from "node:net";
import { Effect } from "effect";

export function staleSocket(path: string) {
	return Effect.promise(
		() =>
			new Promise<void>((resolve, reject) => {
				const server = createServer();
				server.on("error", reject);
				server.listen(`${path}.stale`, () => {
					renameSync(`${path}.stale`, path);
					server.close((error) => (error ? reject(error) : resolve()));
				});
			}),
	);
}
