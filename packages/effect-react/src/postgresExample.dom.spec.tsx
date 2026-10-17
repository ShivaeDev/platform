import { app, realPostgres } from "#test/postgres-example/integration.ts";
import { commitIsHeld, editorsAreOpen } from "#test/postgres-example/liveTraits.ts";
import { expectNoReactWarnings } from "#testing.ts";

expectNoReactWarnings();

app.it(
	"an authenticated PostgreSQL commit reaches another client's query and open editor over live HTTP",
	[realPostgres(), commitIsHeld(), editorsAreOpen("writer", "reader")],
	function* ({
		editName,
		editQuantity,
		submitOrder,
		commitHasEntered,
		storedOrderIs,
		nothingWasPublished,
		editorShows,
		releaseCommit,
		orderWasDelivered,
		revertOrder,
		forbiddenSavesAreRejected,
	}) {
		yield* editName("writer", "  Office chairs  ");
		yield* editQuantity("writer", "450");
		yield* submitOrder("writer");
		yield* commitHasEntered();
		yield* storedOrderIs("Printer paper", 300);
		yield* nothingWasPublished();
		yield* editorShows("reader", "Printer paper", 300, "Printer paper", "Saved");
		yield* releaseCommit();
		yield* editorShows("reader", "Office chairs", 450);
		yield* editorShows("writer", "Office chairs", 450);
		yield* storedOrderIs("Office chairs", 450);
		yield* orderWasDelivered("Office chairs", 450);
		yield* editName("reader", "Unsaved local name");
		yield* editName("writer", "Remote update");
		yield* editQuantity("writer", "900");
		yield* submitOrder("writer");
		yield* editorShows("reader", "Remote update", 900, "Unsaved local name", "Unsaved changes");
		yield* editorShows("writer", "Remote update", 900);
		yield* revertOrder("reader", "Remote update");
		yield* forbiddenSavesAreRejected();
		yield* storedOrderIs("Remote update", 900);
	},
	20_000,
);

app.it(
	"a write recorded inside a rolled-back PostgreSQL transaction publishes no live hint",
	[realPostgres(), commitIsHeld(true), editorsAreOpen("reader")],
	function* ({ beginRejectedSave, commitHasEntered, storedOrderIs, nothingWasPublished, releaseCommit, saveWasRejected, editorShows }) {
		yield* beginRejectedSave();
		yield* commitHasEntered();
		yield* storedOrderIs("Printer paper", 300);
		yield* nothingWasPublished();
		yield* releaseCommit();
		yield* saveWasRejected();
		yield* storedOrderIs("Printer paper", 300);
		yield* nothingWasPublished();
		yield* editorShows("reader", "Printer paper", 300);
	},
	20_000,
);
