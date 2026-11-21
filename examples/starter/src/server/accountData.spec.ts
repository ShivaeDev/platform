import { expect } from "vitest";
import { emptyDatabase, migration } from "#test-support/migration.ts";

migration.it(
	"after every migration, an owned model covers each column that refers to a person, so an account export or erase leaves none out",
	[emptyDatabase],
	function* ({ accountDataCoverage, migrates }) {
		yield* migrates();

		expect(yield* accountDataCoverage()).toBe("covered");
	},
);
