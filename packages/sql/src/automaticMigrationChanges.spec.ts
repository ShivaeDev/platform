import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changeFeed, feedListens, hasTable } from "#test/changeFeed.ts";

changeFeed.it(
	"a migration's repository writes are published only after its batch commits",
	[feedListens(), hasTable("rows")],
	function* ({ appliedMigrations, insertRow, migrate, published }) {
		yield* migrate({
			*"1_seed"() {
				yield* insertRow(1);
				expect(yield* published()).toEqual([]);
			},
		});

		yield* outcomes({
			"applied migrations": [appliedMigrations(), ["1_seed"]],
			"published payloads": [published(), [["rows", "rows:1"]]],
		});
	},
);

changeFeed.it(
	"a failing migration rolls back its repository writes and publishes nothing",
	[feedListens(), hasTable("rows")],
	function* ({ endings, insertRow, migrate, published, rejects, storedRows }) {
		yield* migrate({
			*"1_rejected"() {
				yield* insertRow(2);
				yield* rejects();
			},
		});

		yield* outcomes({
			"migration endings": [endings(), ['failed with a failed migration: Migration "1_rejected" failed']],
			"published payloads": [published(), []],
			"stored rows": [storedRows(), []],
		});
	},
);
