import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, migratedTo, oldSchema, scopedLoader } from "#test/migrationStory.ts";

const OUTSIDE_TRANSACTION_FAILURE = "failed with BadState: Migration steps must run outside a wrapping transaction.";

app.it(
	"after the steps migrated to the first migration, migrating to the latest applies the other two",
	[oldSchema],
	function* ({ appliedMigrations, backfill }) {
		expect(yield* appliedMigrations()).toEqual([1]);

		yield* backfill();

		expect(yield* appliedMigrations()).toEqual([1, 2, 3]);
	},
);

app.it("the steps resolve the loader once, however many times they migrate", [oldSchema], function* ({ backfill, loaderResolutions }) {
	expect(yield* loaderResolutions()).toBe("once");

	yield* backfill();

	expect(yield* loaderResolutions()).toBe("once");
});

app.it(
	"migrating back behind an applied migration fails as a bad state and leaves the applied migrations as they were",
	[migratedTo("2_backfill_emails")],
	function* ({ appliedMigrations, migrateTo, migration }) {
		expect(yield* appliedMigrations()).toEqual([1, 2]);

		yield* migrateTo("1_create_contacts");

		yield* outcomes({
			"applied migrations": [appliedMigrations(), [1, 2]],
			"the migration": [migration(), "failed with BadState: Cannot migrate to 1: later migrations are already applied."],
		});
	},
);

app.it("acquiring migration steps fails with the loader's own failure", [], function* ({ acquireStepsWithFailingLoader }) {
	expect(yield* acquireStepsWithFailingLoader()).toBe("failed with ImportError: loader refused");
});

app.it("the loader's resource stays open while the steps migrate to the latest", [scopedLoader], function* ({ backfill, loaderResource }) {
	expect(yield* loaderResource()).toBe("open");

	yield* backfill();

	expect(yield* loaderResource()).toBe("open");
});

app.it("closing the scope that acquired the steps closes the loader's resource", [scopedLoader], function* ({ closeStepsScope, loaderResource }) {
	expect(yield* loaderResource()).toBe("open");

	yield* closeStepsScope();

	expect(yield* loaderResource()).toBe("closed");
});

app.it(
	"acquiring migration steps inside a rollback test fails asking to run outside a wrapping transaction",
	[],
	function* ({ acquireStepsInRollbackTest }) {
		expect(yield* acquireStepsInRollbackTest()).toBe(OUTSIDE_TRANSACTION_FAILURE);
	},
);

app.it(
	"migrating inside a rollback test with steps acquired outside it fails asking to run outside a wrapping transaction",
	[],
	function* ({ migrateInRollbackTest }) {
		expect(yield* migrateInRollbackTest()).toBe(OUTSIDE_TRANSACTION_FAILURE);
	},
);
