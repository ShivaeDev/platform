import { createConnection } from "node:net";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted } from "effect";
import { databaseAddress } from "#databaseAddress.ts";

export const postgresClient = Effect.fn("AppDatabase.postgresClient")(function* (
	url: Redacted.Redacted<string>,
	options?: Pick<PgClient.PgPoolConfig, "applicationName" | "maxConnections" | "transformQueryNames" | "transformResultNames">,
) {
	const address = databaseAddress(url);
	const disconnected = new Set<Promise<void>>();
	// Native pool shutdown sends Terminate without waiting for its sockets to close.
	yield* Effect.addFinalizer(() => Effect.promise(() => Promise.all([...disconnected])));
	return yield* PgClient.make({
		applicationName: options?.applicationName,
		maxConnections: options?.maxConnections,
		stream: () => {
			const target = new URL(Redacted.value(url));
			const host = address.host ?? target.searchParams.getAll("host").at(-1) ?? (decodeURIComponent(target.hostname) || "localhost");
			const port = address.port ?? 5432;
			const socket = createConnection(host.startsWith("/") ? { path: `${host}/.s.PGSQL.${port}` } : { host, noDelay: true, port });
			const closed = new Promise<void>((resolve) =>
				socket.once("close", () => {
					disconnected.delete(closed);
					resolve();
				}),
			);
			disconnected.add(closed);
			return socket;
		},
		transformQueryNames: options?.transformQueryNames,
		transformResultNames: options?.transformResultNames,
		url,
		...address,
	});
});
