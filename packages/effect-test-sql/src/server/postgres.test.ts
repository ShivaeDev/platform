import { database } from "#test/database.ts";
import { failingFixtures, sequence, withoutFixtures } from "#test/databaseTraits.ts";

database.it(
	"fixtures are optional and migrations are copied to isolated databases",
	[withoutFixtures],
	function* ({ migrationsAreCopiedWithoutFixtures }) {
		yield* migrationsAreCopiedWithoutFixtures();
	},
);

database.it(
	"sequence advances survive rollback while database clones start from the template's sequence state",
	[sequence],
	function* ({ sequenceStateSurvivesRollback }) {
		yield* sequenceStateSurvivesRollback();
	},
);

database.it(
	"failed template preparation preserves the failure and drops the database",
	[failingFixtures],
	function* ({ failedPreparationDropsDatabase }) {
		yield* failedPreparationDropsDatabase();
	},
);
