import { BigDecimal } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { queries } from "#test/queries.ts";

queries.it(
	"delete with an in list and array equality removes only the samples matching both",
	[],
	function* ({ deleteSamples, samples, saveSamples }) {
		yield* saveSamples([
			{ id: 1, values: [10] },
			{ id: 2, values: [20] },
			{ id: 3, values: [10] },
			{ id: 4, values: [10] },
		]);

		yield* deleteSamples({ id: { in: [1, 2, 3] }, values: [10] });

		expect(yield* samples()).toEqual([
			{ id: 2, values: [20] },
			{ id: 4, values: [10] },
		]);
	},
);

queries.it(
	"delete with an empty in list keeps every sample and announces nothing",
	[],
	function* ({ announced, deleteSamples, samples, saveSamples, watch }) {
		yield* saveSamples([{ id: 1, values: [] }]);
		yield* watch("samples", "samples:1");

		yield* deleteSamples({ id: { in: [] } });

		yield* outcomes({
			"announced keys": [announced(), []],
			"stored samples": [samples(), [{ id: 1, values: [] }]],
		});
	},
);

queries.it("delete encodes each in list value with the decimal field's codec", [], function* ({ deletePayments, findPayments, savePayments }) {
	const amount = BigDecimal.fromStringUnsafe;
	yield* savePayments([{ amount: amount("9007199254740993.123456789012") }, { amount: amount("42.125") }, { amount: amount("99.5") }]);

	yield* deletePayments({ amount: { in: [amount("9007199254740993.123456789012"), amount("42.125")] } });

	expect(yield* findPayments({ select: ["amount"] })).toEqual([{ amount: "decimal 99.5" }]);
});

const ledger = [
	{ account: "a", amount: "10", sequence: 1n },
	{ account: "a", amount: "20", sequence: 2n },
	{ account: "b", amount: "30", sequence: 1n },
];

queries.it(
	"a composite-key delete combining account equality with a sequence list removes the matching entry and announces its key",
	[],
	function* ({ announced, deleteLedgerEntries, ledgerEntries, saveLedgerEntries, watch }) {
		yield* saveLedgerEntries(ledger);
		yield* watch("ledger", 'ledger:["a","1"]');

		yield* deleteLedgerEntries({ account: "a", sequence: { in: [1n, 3n] } });

		yield* outcomes({
			"announced keys": [announced(), ["ledger", 'ledger:["a","1"]']],
			"stored entries": [
				ledgerEntries(),
				[
					{ account: "a", amount: "20", sequence: 2n },
					{ account: "b", amount: "30", sequence: 1n },
				],
			],
		});
	},
);

queries.it(
	"a delete by the account part of a composite key removes every entry of that account",
	[],
	function* ({ deleteLedgerEntries, ledgerEntries, saveLedgerEntries }) {
		yield* saveLedgerEntries(ledger);

		yield* deleteLedgerEntries({ account: "a" });

		expect(yield* ledgerEntries()).toEqual([{ account: "b", amount: "30", sequence: 1n }]);
	},
);

queries.it(
	"a list delete announces the keys of the samples it removed and not of the listed id that matched none",
	[],
	function* ({ announced, deleteSamples, samples, saveSamples, watch }) {
		yield* saveSamples([1, 2, 3].map((id) => ({ id, values: [] })));
		yield* watch("samples", "samples:1", "samples:2", "samples:3", "samples:99");

		yield* deleteSamples({ id: { in: [1, 3, 99] } });

		yield* outcomes({
			"announced keys": [announced(), ["samples", "samples:1", "samples:3"]],
			"stored samples": [samples(), [{ id: 2, values: [] }]],
		});
	},
);

queries.it(
	"a list delete inside a rejected transaction keeps its samples and announces nothing",
	[],
	function* ({ announced, deleteSamples, inTransaction, rejects, samples, saveSamples, transactionEndings, watch }) {
		yield* saveSamples([1, 2].map((id) => ({ id, values: [] })));
		yield* watch("samples", "samples:1", "samples:2");

		yield* inTransaction(function* () {
			yield* deleteSamples({ id: { in: [1, 2] } });
			yield* rejects();
		});

		yield* outcomes({
			"announced keys": [announced(), []],
			"stored samples": [
				samples(),
				[
					{ id: 1, values: [] },
					{ id: 2, values: [] },
				],
			],
			"transaction endings": [transactionEndings(), ["failed with rejected"]],
		});
	},
);
