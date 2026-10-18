import { database } from "#test/database.ts";
import { emptyPreparation } from "#test/databaseTraits.ts";
import { app } from "#test/migrationStory.ts";

database.it(
	"empty preparation skips both migrations and fixtures on the shared database and isolated clones",
	[emptyPreparation],
	function* ({ preparationWasSkipped }) {
		yield* preparationWasSkipped();
	},
);

app.it("steps retain loader failures and keep loader resources in the test scope", [], function* ({ loaderResourcesAreScoped }) {
	yield* loaderResourcesAreScoped();
});

app.it("steps can stop again, resume from the ledger and reject going backwards", [], function* ({ stepsResumeAndRejectGoingBackwards }) {
	yield* stepsResumeAndRejectGoingBackwards();
});
