import { createConnection } from "node:net";
import type { PgPoolConfig } from "@effect/sql-pg/PgClient";
import { Effect, Redacted } from "effect";

export const postgresStream = Effect.fn("Sql.postgresStream")(function* (
	url: Redacted.Redacted<string>,
	address: Pick<PgPoolConfig, "host" | "port">,
) {
	const disconnected = new Set<Promise<void>>();
	// Native pool shutdown sends Terminate without waiting for its sockets to close.
	yield* Effect.addFinalizer(() => Effect.promise(() => Promise.all([...disconnected])));
	return () => {
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
	};
});
