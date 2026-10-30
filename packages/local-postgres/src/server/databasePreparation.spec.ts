import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { postgres } from "#test/postgres.ts";
import { appDatabaseMissing, appDatabaseWithRow, realPostgres } from "#test/postgresTraits.ts";

postgres.it(
	"preparing creates the app database when it does not exist yet",
	[realPostgres(), appDatabaseMissing()],
	function* ({ appDatabase, prepareAppDatabase }) {
		expect(yield* appDatabase()).toBe("absent");

		yield* prepareAppDatabase();

		expect(yield* appDatabase()).toBe("present");
	},
);

postgres.it(
	"preparing the app database again succeeds and keeps its rows",
	[realPostgres(), appDatabaseWithRow()],
	function* ({ appRows, outcome, prepareAppDatabase }) {
		expect(yield* appRows()).toEqual(["existing data"]);

		yield* prepareAppDatabase();

		yield* outcomes({
			"rows": [appRows(), ["existing data"]],
			"setup": [outcome(), "prepared"],
		});
	},
);
