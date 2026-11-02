import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { existingGroups, groupPurges, secondGroupRejectsDeletion } from "#test/groupPurges.ts";

const original = [
	{ children: 2, id: 1 },
	{ children: 1, id: 2 },
	{ children: 3, id: 3 },
	{ children: 1, id: 4 },
];
const bob = [{ children: 1, id: 4 }];
const ELIGIBLE_ROW_COUNT = 9;
const SHARED_BATCH_BUDGET = 5;

groupPurges.it(
	"whole groups commit within each batch budget until the selection is exhausted",
	[existingGroups()],
	function* ({ purge, storedGroups, committedGroups }) {
		expect(yield* storedGroups()).toEqual(original);

		const removed = yield* purge(4, ELIGIBLE_ROW_COUNT + 1);

		expect(removed).toBe(ELIGIBLE_ROW_COUNT);
		yield* outcomes([
			["stored groups", storedGroups, bob],
			["groups after each commit", committedGroups, [original.slice(1), original.slice(2), bob]],
		]);
	},
);

groupPurges.it(
	"several groups share a batch and the remaining total budget never splits the next group",
	[existingGroups()],
	function* ({ purge, storedGroups, committedGroups }) {
		const removed = yield* purge(SHARED_BATCH_BUDGET, 8);

		expect(removed).toBe(SHARED_BATCH_BUDGET);
		yield* outcomes([
			["stored groups", storedGroups, original.slice(2)],
			["committed batches", committedGroups, [original.slice(2)]],
		]);
	},
);

for (const budget of [0, 1, 2]) {
	groupPurges.it(
		`a ${budget}-row budget leaves an oversized first group intact and announces nothing`,
		[existingGroups()],
		function* ({ purge, storedGroups, publications }) {
			const removed = yield* purge(5, budget);

			expect(removed).toBe(0);
			yield* outcomes([
				["stored groups", storedGroups, original],
				["published changes", publications, []],
			]);
		},
	);
}

groupPurges.it(
	"a failed batch restores its children, announces nothing and preserves the earlier committed group",
	[existingGroups(), secondGroupRejectsDeletion()],
	function* ({ purgeFailure, storedGroups, committedGroups }) {
		const failure = yield* purgeFailure(4, 9);

		expect(failure).toBe("a constraint violation (SQLSTATE 23514)");
		yield* outcomes([
			["stored groups", storedGroups, original.slice(1)],
			["committed groups", committedGroups, [original.slice(1)]],
		]);
	},
);

groupPurges.it(
	"a later group failure rolls back every group in the same batch and publishes nothing",
	[existingGroups(), secondGroupRejectsDeletion()],
	function* ({ purgeFailure, storedGroups, publications }) {
		const failure = yield* purgeFailure(5, 9);

		expect(failure).toBe("a constraint violation (SQLSTATE 23514)");
		yield* outcomes([
			["stored groups", storedGroups, original],
			["published changes", publications, []],
		]);
	},
);
