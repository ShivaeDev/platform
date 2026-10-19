import { Effect } from "effect";
import { expect } from "vitest";
import { PostgresVersionMismatch } from "#PostgresVersionMismatch.ts";
import { olderPostgres } from "#test/olderPostgres.ts";
import { postgres } from "#test/postgres.ts";

postgres.it(
	"refuses a running PostgreSQL 17 service with its version and preserves its data",
	[olderPostgres],
	function* ({ query, start }) {
		const version = query("SHOW server_version");
		expect(version).toMatch(/^17\./u);
		query("CREATE TABLE preserved (value text); INSERT INTO preserved VALUES ('existing data')");
		let failure: unknown;
		try {
			start();
		} catch (error) {
			failure = error;
		}
		expect(failure).toBeInstanceOf(PostgresVersionMismatch);
		expect(failure).toMatchObject({ _tag: "PostgresVersionMismatch", expectedVersion: "18.6", observedVersion: version });
		expect(query("SELECT value FROM preserved")).toBe("existing data");
		yield* Effect.void;
	},
	120_000,
);
