import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { seededAppDatabase } from "#test/databaseTraits.ts";
import { dockerStories } from "#test/dockerStories.ts";
import { olderPostgres } from "#test/olderPostgres.ts";
import { postgres } from "#test/postgres.ts";
import { serviceAnswers } from "#test/postgresTraits.ts";

for (const version of ["18.6", "18.6 (Ubuntu 18.6-1.pgdg24.04+1)", "18.6 (Homebrew)"]) {
	postgres.it(`setup accepts the supported version string ${version}`, [serviceAnswers(version)], function* ({ outcome, start }) {
		yield* start();

		expect(yield* outcome()).toBe("started");
	});
}

dockerStories.it(
	"refusing PostgreSQL 17 leaves the app's existing rows readable",
	[olderPostgres, seededAppDatabase()],
	function* ({ appRows, outcome, prepareAppDatabase }) {
		expect(yield* appRows()).toEqual(["existing data"]);

		yield* prepareAppDatabase();

		yield* outcomes([
			["setup", () => outcome(), expect.stringMatching(/^version mismatch: expected 18\.6, observed 17\./u)],
			["rows", () => appRows(), ["existing data"]],
		]);
	},
	120_000,
);
