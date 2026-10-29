import { expect } from "vitest";
import { keyStory, rows } from "#test/keyStory.ts";

keyStory.it(
	"committing row 1 for alice in list 42 refreshes the readers of row 1, of alice's rows and of list 42, and leaves bob's reader alone",
	[],
	function* ({ watch, opensTransaction, refreshed }) {
		yield* watch("row 1's reader", [rows.item(1)]);
		yield* watch("alice's reader", [rows.bucket.userId("alice")]);
		yield* watch("bob's reader", [rows.bucket.userId("bob")]);
		yield* watch("list 42's reader", [rows.bucket.listId(42)]);
		const transaction = yield* opensTransaction();
		yield* transaction.record([rows.item(1), rows.bucket.userId("alice"), rows.bucket.listId(42)]);
		expect(refreshed()).toEqual([]);

		yield* transaction.commit();

		expect(refreshed()).toEqual(["row 1's reader", "alice's reader", "list 42's reader"]);
	},
);
