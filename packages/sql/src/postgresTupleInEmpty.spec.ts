import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { queries, sourceRows } from "#test/queries.ts";
import { SourceRow } from "#test/queryModels.ts";
import { tupleIn } from "#tupleIn.ts";

const noTuples = tupleIn(SourceRow, ["sourceKey", "amount"], []);

queries.it("findMany with an empty tuple list reads no sources", [sourceRows()], function* ({ findSources }) {
	const found = yield* findSources({ where: noTuples });

	expect(found).toEqual([]);
});

queries.it("a select with an empty tuple list copies no sources", [sourceRows()], function* ({ copies, copySelected, lastResult }) {
	yield* copySelected({ where: noTuples });

	yield* outcomes({
		"copied rows returned": [lastResult(), []],
		"stored copies": [copies(), []],
	});
});

queries.it("delete with an empty tuple list keeps every source", [sourceRows()], function* ({ deleteSources, sources }) {
	yield* deleteSources(noTuples);

	expect(yield* sources()).toEqual([
		{ amount: 10, displayName: "first", sourceKey: 1, status: "flaky" },
		{ amount: 20, displayName: "second", sourceKey: 2, status: "flaky" },
		{ amount: 30, displayName: "stable", sourceKey: 3, status: "stable" },
		{ amount: 40, displayName: "fourth", sourceKey: 4, status: "flaky" },
	]);
});
