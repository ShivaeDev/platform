import { expect } from "vitest";
import { realPostgres } from "#test/postgresTraits.ts";
import { sharedPostgres as postgres } from "#test/sharedPostgres.ts";

const SERVER = "postgresql://postgres:postgres@127.0.0.1:55432";

for (const setting of ["schema=public", "connection_limit=1", "pool_timeout=10", "pgbouncer=true"]) {
	postgres.it(
		`a query whose URL carries the application setting ${setting} still reaches PostgreSQL`,
		[realPostgres()],
		function* ({ outcome, query }) {
			yield* query("SHOW server_version", `${SERVER}/postgres?${setting}`);

			expect(yield* outcome()).toBe("18.6");
		},
	);
}
