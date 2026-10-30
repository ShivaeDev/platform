import { Schema } from "effect";
import { expect } from "vitest";
import { collection, compositeId, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { writeKeys } from "#test/writeKeys.ts";

writeKeys.it(
	"a composite repository write refreshes its record subscriber and leaves other records alone",
	[],
	function* ({ compositeLedger, watch, refreshed, insertEntry, publishedKeys }) {
		const { tableName } = compositeLedger();
		const sequence = 9_007_199_254_740_993n;
		const ledger = collection(tableName, Schema.String);
		const item = ledger.item(compositeId(["cash", sequence]));
		yield* watch("cash entry", [item]);
		yield* watch("next cash entry", [ledger.item(compositeId(["cash", sequence + 1n]))]);
		yield* watch("bank entry", [ledger.item(compositeId(["bank", sequence]))]);
		expect(refreshed()).toEqual([]);

		yield* insertEntry("cash", sequence);

		expect(publishedKeys()).toEqual(invalidationKeys([ledger.list, item]));
		expect(refreshed()).toEqual(["cash entry"]);
	},
);

writeKeys.it(
	"manual composite invalidations refresh the same record subscriber as repository writes",
	[],
	function* ({ compositeLedger, watch, refreshed, insertEntry, invalidateEntry }) {
		const { tableName } = compositeLedger();
		const sequence = 9_007_199_254_740_993n;
		const id = compositeId(["cash", sequence]);
		const ledger = collection(tableName, Schema.String);
		yield* watch("cash entry", [ledger.item(id)]);
		expect(refreshed()).toEqual([]);

		yield* insertEntry("cash", sequence);

		expect(refreshed()).toEqual(["cash entry"]);

		yield* invalidateEntry(id);

		expect(refreshed()).toEqual(["cash entry", "cash entry"]);
	},
);
