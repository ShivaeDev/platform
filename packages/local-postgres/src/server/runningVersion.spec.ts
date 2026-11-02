import { expect } from "vitest";
import { postgres } from "#test/postgres.ts";
import { serviceAnswers } from "#test/postgresTraits.ts";

for (const version of ["18.6", "18.6 (Ubuntu 18.6-1.pgdg24.04+1)", "18.6 (Homebrew)"]) {
	postgres.it(`setup accepts the supported version string ${version}`, [serviceAnswers(version)], function* ({ outcome, start }) {
		yield* start();

		expect(yield* outcome()).toBe("started");
	});
}
