import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { database } from "#test/database.ts";
import { failingPreparation, preparationDisabled, sequence, sharedDrewId, withoutFixtures } from "#test/databaseTraits.ts";

database.it("without fixtures, a clone has the migrated schema and no rows", [withoutFixtures], function* ({ appliedMigrations, items }) {
	yield* outcomes({
		"applied migrations in a new clone": [appliedMigrations("a new clone"), [1]],
		"items in a new clone": [items("a new clone"), []],
	});
});

database.it(
	"a clone draws the template's first sequence id even after the shared database drew it",
	[sequence, sharedDrewId],
	function* ({ nextId }) {
		expect(yield* nextId("a new clone")).toBe("id 1");
	},
);

database.it(
	"when the initializer fails, starting the worker fails with its failure, without running the fixtures",
	[failingPreparation("the initializer")],
	function* ({ workerStart }) {
		expect(yield* workerStart()).toBe("failed with the initializer failed");
	},
);

database.it(
	"when the fixtures fail, starting the worker fails with their failure",
	[failingPreparation("the fixtures")],
	function* ({ workerStart }) {
		expect(yield* workerStart()).toBe("failed with the fixtures failed");
	},
);

for (const step of ["the initializer", "the fixtures"] as const) {
	database.it(
		`when ${step} fail, starting the worker drops both templates that existed while they ran before it reports the failure`,
		[failingPreparation(step)],
		function* ({ databasesDuringPreparation, workerDatabases }) {
			yield* outcomes({
				[`databases while ${step} ran`]: [databasesDuringPreparation(), ["the empty template", "the migrated template"]],
				"databases once the start failed": [workerDatabases(), []],
			});
		},
	);
}

for (const strategy of ["an initializer", "migrations"] as const) {
	database.it(
		`with preparation disabled for ${strategy}, the worker starts without running it or the fixtures, with no tables in its shared database or a clone`,
		[preparationDisabled(strategy)],
		function* ({ tables, workerStart }) {
			yield* outcomes({
				"tables in a new clone": [tables("a new clone"), []],
				"tables in the shared database": [tables("the shared database"), []],
				"the worker": [workerStart(), "started"],
			});
		},
	);
}
