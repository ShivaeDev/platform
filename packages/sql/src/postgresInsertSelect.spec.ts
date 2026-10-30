import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { queries, sourceRows } from "#test/queries.ts";

queries.it(
	"insertFromSelect copies the two highest flaky sources through the column mapping and returns them decoded with their generated fields",
	[sourceRows()],
	function* ({ copySelected, lastResult, storedCopyAmounts }) {
		yield* copySelected({
			limit: 2,
			orderBy: { direction: "desc", field: "sourceKey" },
			select: ["sourceKey", "displayName", "amount"],
			where: { status: "flaky" },
		});

		yield* outcomes({
			"returned copies": [
				lastResult(),
				[
					{ amount: 20, copiedKey: 2, createdAt: expect.any(Date), id: expect.any(Number), name: "second" },
					{ amount: 40, copiedKey: 4, createdAt: expect.any(Date), id: expect.any(Number), name: "fourth" },
				],
			],
			"stored amounts": [storedCopyAmounts(), [{ amount: "20" }, { amount: "40" }]],
		});
	},
);

queries.it(
	"insertFromSelectOrIgnore skips a copied key that already exists, keeps that copy unchanged and returns only the new copies",
	[sourceRows()],
	function* ({ copies, copySelectedOrIgnore, lastResult, saveCopy }) {
		yield* saveCopy({ amount: 99, copiedKey: 2, name: "existing" });

		yield* copySelectedOrIgnore({ where: { status: "flaky" } });

		yield* outcomes({
			"returned copies": [
				lastResult(),
				[expect.objectContaining({ copiedKey: 1, name: "first" }), expect.objectContaining({ copiedKey: 4, name: "fourth" })],
			],
			"stored copies": [
				copies(),
				[
					{ amount: 10, copiedKey: 1, name: "first" },
					{ amount: 99, copiedKey: 2, name: "existing" },
					{ amount: 40, copiedKey: 4, name: "fourth" },
				],
			],
		});
	},
);

const modes = [
	{ name: "insertFromSelect", verb: "copySelected" },
	{ name: "insertFromSelectOrIgnore", verb: "copySelectedOrIgnore" },
] as const;

for (const { name, verb } of modes) {
	queries.it(`${name} of a select matching no sources copies nothing`, [sourceRows()], function* (verbs) {
		const copy = verbs[verb];

		yield* copy({ where: { status: "missing" } });

		yield* outcomes({
			"returned copies": [verbs.lastResult(), []],
			"stored copies": [verbs.copies(), []],
		});
	});
}

queries.it(
	"insertFromSelect inside a rejected transaction leaves no copies behind",
	[sourceRows()],
	function* ({ copies, copySelected, copySelectedOrIgnore, inTransaction, rejects, transactionEndings }) {
		yield* inTransaction(function* () {
			yield* copySelected({ where: { sourceKey: 1 } });
			yield* copySelectedOrIgnore({ where: { sourceKey: 2 } });
			expect(yield* copies()).toEqual([
				{ amount: 10, copiedKey: 1, name: "first" },
				{ amount: 20, copiedKey: 2, name: "second" },
			]);
			yield* rejects();
		});

		yield* outcomes({
			"stored copies": [copies(), []],
			"transaction endings": [transactionEndings(), ["failed with rejected"]],
		});
	},
);
