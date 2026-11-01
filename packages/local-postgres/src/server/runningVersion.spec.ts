import { expect } from "vitest";
import { olderPostgres } from "#test/olderPostgres.ts";
import { postgres } from "#test/postgres.ts";
import { serviceAnswers } from "#test/postgresTraits.ts";

postgres.it(
	"setup refuses a running PostgreSQL 17 service with a version mismatch that names its version",
	[olderPostgres],
	function* ({ outcome, runningVersion, start }) {
		const version = yield* runningVersion();
		expect(version).toMatch(/^17\./u);

		yield* start();

		expect(yield* outcome()).toBe(`version mismatch: expected 18.6, observed ${version}`);
	},
	120_000,
);

for (const version of ["18.6", "18.6 (Ubuntu 18.6-1.pgdg24.04+1)", "18.6 (Homebrew)"]) {
	postgres.it(`setup accepts the supported version string ${version}`, [serviceAnswers(version)], function* ({ outcome, start }) {
		yield* start();

		expect(yield* outcome()).toBe("started");
	});
}
