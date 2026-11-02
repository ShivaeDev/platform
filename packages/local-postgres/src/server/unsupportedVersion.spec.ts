import { expect } from "vitest";
import { dockerStories } from "#test/dockerStories.ts";
import { olderPostgres } from "#test/olderPostgres.ts";

dockerStories.it(
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
