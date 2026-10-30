import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { database } from "#test/database.ts";
import { isolatedBlockOpen } from "#test/databaseTraits.ts";

database.it(
	"an application Layer built inside an isolated block writes to its clone and not to the shared database",
	[isolatedBlockOpen()],
	function* ({ buildItemsServiceAndRename, items }) {
		expect(yield* items("the isolated block")).toEqual(["seed"]);

		yield* buildItemsServiceAndRename("isolated", "the isolated block");

		yield* outcomes({
			"items in the clone": [items("the isolated block"), ["isolated"]],
			"items in the shared database": [items("the shared database"), ["seed"]],
		});
	},
);
