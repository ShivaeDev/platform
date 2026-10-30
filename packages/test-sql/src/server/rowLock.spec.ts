import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { database } from "#test/database.ts";
import { poolLimit } from "#test/databaseTraits.ts";

database.it(
	"a second rollback test writes the row a first rollback test holds once the first rolls back, and both writes roll back",
	[poolLimit(3)],
	function* ({ items, secondTestSaw, secondTestWritesLockedRow }) {
		yield* secondTestWritesLockedRow();

		yield* outcomes({
			"items in the shared database": [items("the shared database"), ["seed"]],
			"items the second test saw": [secondTestSaw(), ["second"]],
		});
	},
);
