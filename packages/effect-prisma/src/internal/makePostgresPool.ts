import type { PostgresOptionsBase } from "@prisma-next/postgres/runtime";
import { Client, Pool, type PoolClient } from "pg";

function closeFailedClient(client: PoolClient): void {
	if (client instanceof Client) {
		void client.end();
	}
}

export function makePostgresPool(url: string, options: PostgresOptionsBase["poolOptions"]): Pool {
	const pool = new Pool({
		connectionString: url.trim(),
		connectionTimeoutMillis: options?.connectionTimeoutMillis ?? 20_000,
		idleTimeoutMillis: options?.idleTimeoutMillis ?? 30_000,
	});
	pool.on("connect", (client) => {
		client.on("error", () => {
			// pg rejects pending queries with the original error before emitting it.
			// Close the failed socket; Prisma Next still owns rejection and release.
			closeFailedClient(client);
		});
	});
	pool.on("error", (_error, client) => {
		closeFailedClient(client);
	});
	return pool;
}
