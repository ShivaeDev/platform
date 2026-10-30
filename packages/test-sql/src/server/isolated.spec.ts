import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { database } from "#test/database.ts";
import { isolatedBlockOpen, itemWritten } from "#test/databaseTraits.ts";

database.it(
	"an isolated block opened after the shared database changed starts from the template's fixtures",
	[itemWritten("shared", "the shared database"), isolatedBlockOpen()],
	function* ({ items }) {
		expect(yield* items("the isolated block")).toEqual(["seed"]);
	},
);

database.it(
	"a commit in an isolated block reaches another connection to its clone",
	[isolatedBlockOpen()],
	function* ({ itemsThroughAnotherConnection, writeItem }) {
		expect(yield* itemsThroughAnotherConnection("the isolated block")).toEqual(["seed"]);

		yield* writeItem("committed", "the isolated block");

		expect(yield* itemsThroughAnotherConnection("the isolated block")).toEqual(["committed"]);
	},
);

database.it(
	"two isolated blocks open at the same time write to separate clones",
	[isolatedBlockOpen("the first block"), isolatedBlockOpen("the second block")],
	function* ({ items, writeItem }) {
		expect(yield* items("the first block")).toEqual(["seed"]);

		yield* writeItem("first", "the first block");

		yield* outcomes({
			"items in the first block": [items("the first block"), ["first"]],
			"items in the second block": [items("the second block"), ["seed"]],
		});
	},
);

database.it("opening an isolated block runs neither the migrations nor the fixtures again", [], function* ({ openIsolatedBlock, preparationRuns }) {
	expect(yield* preparationRuns()).toEqual({ fixtures: 1, migrations: 1 });

	yield* openIsolatedBlock("the isolated block");

	expect(yield* preparationRuns()).toEqual({ fixtures: 1, migrations: 1 });
});

for (const [ending, outcome] of [
	["succeeds", "succeeded"],
	["fails with rejected", "failed with rejected"],
	["dies with assertion failed", "died with assertion failed"],
] as const) {
	database.it(
		`an isolated block that ${ending} ends ${outcome}, and its clone is dropped`,
		[isolatedBlockOpen()],
		function* ({ blockOutcome, cloneDatabase, end }) {
			expect(yield* cloneDatabase("the isolated block")).toBe("exists");

			yield* end("the isolated block", ending);

			yield* outcomes({
				"its clone": [cloneDatabase("the isolated block"), "dropped"],
				"the isolated block": [blockOutcome("the isolated block"), outcome],
			});
		},
	);
}

database.it(
	"an interrupted isolated block ends interrupted, and its clone is dropped",
	[isolatedBlockOpen()],
	function* ({ blockOutcome, cloneDatabase, interrupt }) {
		expect(yield* cloneDatabase("the isolated block")).toBe("exists");

		yield* interrupt("the isolated block");

		yield* outcomes({
			"its clone": [cloneDatabase("the isolated block"), "dropped"],
			"the isolated block": [blockOutcome("the isolated block"), "interrupted"],
		});
	},
);

database.it(
	"closing the worker drops its empty template, its migrated template and its shared database",
	[],
	function* ({ closeWorker, workerDatabases }) {
		expect(yield* workerDatabases()).toEqual(["the empty template", "the migrated template", "the shared database"]);

		yield* closeWorker();

		expect(yield* workerDatabases()).toEqual([]);
	},
);
