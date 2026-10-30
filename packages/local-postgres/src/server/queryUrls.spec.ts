import { expect } from "vitest";
import { postgres } from "#test/postgres.ts";
import { realPostgres } from "#test/postgresTraits.ts";

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

postgres.it(
	"a query keeps an explicit connect_timeout, so an invalid one fails with psql's complaint",
	[realPostgres()],
	function* ({ outcome, query }) {
		yield* query("SHOW server_version", `${SERVER}/postgres?connect_timeout=invalid`);

		expect(yield* outcome()).toContain('invalid integer value "invalid" for connection option "connect_timeout"');
	},
);
