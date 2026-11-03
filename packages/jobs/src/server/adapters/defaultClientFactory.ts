import { Socket } from "node:net";
import { PgBoss } from "pg-boss";
import type { ClientOptions } from "#server/clientOptions.ts";
import type { EngineClient } from "#server/engineClient.ts";

export function defaultClientFactory(options: ClientOptions): EngineClient {
	const disconnected = new Set<Promise<void>>();
	const config = {
		...options,
		stream: () => {
			const socket = new Socket();
			const closed = new Promise<void>((resolve) =>
				socket.once("close", () => {
					disconnected.delete(closed);
					resolve();
				}),
			);
			disconnected.add(closed);
			return socket;
		},
	};
	const client = new PgBoss(config);
	const stop = client.stop.bind(client);
	client.stop = async (stopOptions) => {
		await stop(stopOptions);
		// pg-boss's pool shutdown does not wait for its transports to disconnect.
		if (stopOptions?.close !== false) {
			await Promise.all([...disconnected]);
		}
	};
	return client;
}
