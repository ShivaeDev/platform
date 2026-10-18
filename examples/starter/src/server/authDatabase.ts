import { Effect, Redacted } from "effect";
import { Pool, type PoolClient } from "pg";

export const authDatabase = Effect.fn("App.authDatabase")(function* (url: Redacted.Redacted<string>) {
	const clients = new Set<PoolClient>();
	const run = Effect.runForkWith(yield* Effect.context<never>());
	return yield* Effect.acquireRelease(
		Effect.sync(() => {
			const pool = new Pool({ connectionString: Redacted.value(url) });
			pool.on("connect", (client) => clients.add(client));
			pool.on("remove", (client) => clients.delete(client));
			pool.on("error", (error) => {
				run(Effect.logDebug({ event: "auth_database_idle_client_failed", message: error.message }));
			});
			return pool;
		}),
		(pool) =>
			Effect.promise(async () => {
				// pg-pool resolves end before its clients finish disconnecting.
				const disconnected = [...clients].map((client) => new Promise<void>((resolve) => client.once("end", resolve)));
				await pool.end();
				await Promise.all(disconnected);
			}),
	);
});
