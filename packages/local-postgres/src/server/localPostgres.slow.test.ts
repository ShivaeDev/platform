import { expect } from "vitest";
import { postgres } from "#test/postgres.ts";
import { discoveryFails } from "#test/postgresTraits.ts";

postgres.it(
	"stops after thirty readiness attempts when Docker never reports a PostgreSQL container",
	[discoveryFails(31)],
	function* ({ start, stop }) {
		expect(start).toThrow("Expected local PostgreSQL 18.6. Check the existing service; setup never removes containers or data.");
		yield* stop(31);
	},
	60_000,
);
