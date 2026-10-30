import { Schema } from "effect";
import { expect } from "vitest";
import { collection, compositeId, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { hasCompositeLedger } from "#test/repositoryTraits.ts";
import { writeKeys } from "#test/writeKeysStory.ts";

writeKeys.it(
	"a composite repository write refreshes its record subscriber and leaves other records alone",
	[hasCompositeLedger()],
	function* ({ compositeLedger, watch, refreshed, observePublication, publishedKeys }) {
		const { entries, tableName } = compositeLedger();
		const sequence = 9_007_199_254_740_993n;
		const ledger = collection(tableName, Schema.String);
		const item = ledger.item(compositeId(["cash", sequence]));
		yield* watch("cash entry", [item]);
		yield* watch("next cash entry", [ledger.item(compositeId(["cash", sequence + 1n]))]);
		yield* watch("bank entry", [ledger.item(compositeId(["bank", sequence]))]);
		expect(refreshed()).toEqual([]);

		yield* entries.insert({ account: "cash", amount: "7", sequence }).pipe(observePublication);

		expect(publishedKeys()).toEqual(invalidationKeys([ledger.list, item]));
		expect(refreshed()).toEqual(["cash entry"]);
	},
);

writeKeys.it(
	"manual composite invalidations refresh the same record subscriber as repository writes",
	[hasCompositeLedger()],
	function* ({ compositeLedger, watch, refreshed, invalidateOnCommit, transact }) {
		const { entries, tableName } = compositeLedger();
		const sequence = 9_007_199_254_740_993n;
		const id = compositeId(["cash", sequence]);
		const ledger = collection(tableName, Schema.String);
		yield* watch("cash entry", [ledger.item(id)]);
		expect(refreshed()).toEqual([]);

		yield* entries.insert({ account: "cash", amount: "7", sequence });

		expect(refreshed()).toEqual(["cash entry"]);

		yield* invalidateOnCommit({ [tableName]: [id] }).pipe(transact({ onSqlError: (error) => error }));

		expect(refreshed()).toEqual(["cash entry", "cash entry"]);
	},
);
