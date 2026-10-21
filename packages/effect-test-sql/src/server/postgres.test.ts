import { Result } from "effect";
import { expect } from "vitest";
import { database } from "#test/database.ts";
import { failingFixtures, sequence, withoutFixtures } from "#test/databaseTraits.ts";

database.it(
	"fixtures are optional and migrations are copied to isolated databases",
	[withoutFixtures],
	function* ({ readCloneMigrations, readPreparationCounts }) {
		expect(yield* readCloneMigrations()).toEqual({ items: [], ledger: [{ "migration_id": 1 }] });
		expect(yield* readPreparationCounts()).toEqual({ fixtures: 0, migrations: 1 });
	},
);
database.it(
	"sequence advances survive rollback while database clones start from the template's sequence state",
	[sequence],
	function* ({ nextInRollback, nextInShared, nextInClone }) {
		expect(yield* nextInRollback()).toEqual([{ id: 1 }]);
		expect(yield* nextInShared()).toEqual([{ id: 2 }]);
		expect(yield* nextInClone()).toEqual([{ id: 1 }]);
	},
);
database.it(
	"failed template preparation preserves the failure and drops the database",
	[failingFixtures],
	function* ({ readAcquisition, closeWorker, readTemplate, readDatabases }) {
		expect(yield* readAcquisition()).toEqual(Result.fail("fixtures failed"));
		yield* closeWorker();
		const template = yield* readTemplate();
		expect(template).not.toBe("");
		expect(yield* readDatabases([template])).toEqual([]);
	},
);
