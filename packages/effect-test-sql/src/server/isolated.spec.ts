import { database } from "#test/database.ts";
import { committingClones } from "#test/databaseTraits.ts";

database.it(
	"isolated databases clone prepared fixtures once, commit for real, and drop after use",
	[committingClones],
	function* ({ clonesCommitAndDrop }) {
		yield* clonesCommitAndDrop();
	},
);

database.it("isolated databases clean up after typed failure, defects and interruption", [], function* ({ clonesCleanUpEveryExit }) {
	yield* clonesCleanUpEveryExit();
});

database.it(
	"closing the worker scope drops both the template and shared database",
	[],
	function* ({ workerDatabasesExist, workerDatabasesAreDropped }) {
		yield* workerDatabasesExist();
		yield* workerDatabasesAreDropped();
	},
);
