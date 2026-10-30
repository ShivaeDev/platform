import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { constraints } from "#test/constraints.ts";

constraints.it(
	"a transaction that waits on an uncommitted insert of the same name fails with name taken after the winner commits and rolls back its earlier insert",
	[],
	function* ({ endings, insertItemsWhileNameLocked, storedItems }) {
		yield* insertItemsWhileNameLocked("Shared", [
			{ name: "Must roll back", quantity: 2 },
			{ name: "Shared", quantity: 3 },
		]);

		yield* outcomes({
			"losing transaction": [endings(), ["failed with name taken"]],
			"stored items": [storedItems(), [{ name: "Shared", quantity: 1 }]],
		});
	},
);
