import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { indexedRuns, queries } from "#test/queries.ts";
import { LatestRun } from "#test/queryModels.ts";
import { tupleIn } from "#tupleIn.ts";

const threeAmountsPerGroup = ["build", "deploy"].flatMap((note) => [1, 2, 3].map((amount) => ({ amount, name: "A", note })));

queries.it(
	"latestPerGroup reads the two highest-amount lines of every name and note group in one statement",
	[],
	function* ({ lastResult, latestLines, saveLines, statementsSent }) {
		yield* saveLines([...threeAmountsPerGroup, ...[1, 2, 3].map((amount) => ({ amount, name: "B", note: "build" }))]);

		yield* latestLines({
			limit: 2,
			orderBy: [
				{ direction: "desc", field: "amount" },
				{ direction: "desc", field: "id" },
			],
			partitionBy: ["name", "note"],
		});

		yield* outcomes({
			"latest lines": [
				lastResult(),
				[
					{ amount: 3, id: 3, name: "A", note: "build" },
					{ amount: 2, id: 2, name: "A", note: "build" },
					{ amount: 3, id: 6, name: "A", note: "deploy" },
					{ amount: 2, id: 5, name: "A", note: "deploy" },
					{ amount: 3, id: 9, name: "B", note: "build" },
					{ amount: 2, id: 8, name: "B", note: "build" },
				],
			],
			"statements sent": [statementsSent(), 1],
		});
	},
);

const tieBreaks = [
	{ direction: "asc", expected: [4, 1] },
	{ direction: "desc", expected: [4, 3] },
] as const;

for (const { direction, expected } of tieBreaks) {
	queries.it(
		`latestPerGroup breaks the tie among three equal amounts at the limit by ${direction}ending id in a pinned group`,
		[],
		function* ({ latestLines, saveLines }) {
			yield* saveLines([1, 1, 1, 2].map((amount) => ({ amount, name: "A", note: null })));

			const latest = yield* latestLines({
				limit: 2,
				orderBy: [
					{ direction: "desc", field: "amount" },
					{ direction, field: "id" },
				],
				partitionBy: ["name"],
				where: { name: "A" },
			});

			expect(latest).toEqual(expected.map((id) => ({ amount: id === 4 ? 2 : 1, id, name: "A", note: null })));
		},
	);
}

const twoAsAndOneB = [
	{ amount: 1, name: "A", note: null },
	{ amount: 2, name: "A", note: null },
	{ amount: 3, name: "B", note: null },
];

const newestPerName = { orderBy: [{ direction: "desc", field: "id" }], partitionBy: ["name"] } as const;

queries.it("latestPerGroup returns every line of a group smaller than the limit", [], function* ({ latestLines, saveLines }) {
	yield* saveLines(twoAsAndOneB);

	const latest = yield* latestLines({ ...newestPerName, limit: 3 });

	expect(latest).toEqual([
		{ amount: 2, id: 2, name: "A", note: null },
		{ amount: 1, id: 1, name: "A", note: null },
		{ amount: 3, id: 3, name: "B", note: null },
	]);
});

queries.it("latestPerGroup with a zero limit returns no lines", [], function* ({ latestLines, saveLines }) {
	yield* saveLines(twoAsAndOneB);

	const latest = yield* latestLines({ ...newestPerName, limit: 0 });

	expect(latest).toEqual([]);
});

queries.it(
	"latestPerGroup encodes its equality, in and null filters before ranking, so excluded lines never take a group's place",
	[],
	function* ({ latestLines, saveLines }) {
		yield* saveLines([
			{ amount: 1, name: "A", note: null },
			{ amount: 1, name: "B", note: null },
			{ amount: 1, name: "C", note: null },
			{ amount: 2, name: "A", note: null },
			{ amount: 1, name: "A", note: "hidden" },
			{ amount: 1, name: "B", note: "hidden" },
		]);

		const latest = yield* latestLines({
			limit: 1,
			orderBy: [{ direction: "desc", field: "id" }],
			partitionBy: ["name"],
			where: { amount: 1, name: { in: ["A", "B"] }, note: null },
		});

		expect(latest).toEqual([
			{ amount: 1, id: 1, name: "A", note: null },
			{ amount: 1, id: 2, name: "B", note: null },
		]);
	},
);

const newestTwenty = { limit: 20, orderBy: [{ direction: "desc", field: "id" }] } as const;

const pins = [
	{ groups: 1, matches: (run: LatestRun) => run.repository === 2, name: "encoded equality", partitionBy: ["repository"], where: { repository: 2 } },
	{
		groups: 2,
		matches: (run: LatestRun) => run.repository !== 2,
		name: "an unordered in list with duplicates",
		partitionBy: ["repository"],
		where: { repository: { in: [3, 1, 3] } },
	},
	{
		groups: 4,
		matches: (run: LatestRun) => run.repository !== 2 && run.workflow !== null,
		name: "in lists on both partition fields",
		partitionBy: ["repository", "workflow"],
		where: { repository: { in: [3, 1] }, workflow: { in: ["deploy", "build"] } },
	},
	{
		groups: 1,
		matches: (run: LatestRun) => run.repository === 1 && run.workflow === null,
		name: "a null workflow",
		partitionBy: ["repository", "workflow"],
		where: { repository: 1, workflow: null },
	},
	{
		groups: 2,
		matches: (run: LatestRun) => run.repository === 1 && run.workflow !== "deploy",
		name: "an in list holding null and a workflow",
		partitionBy: ["repository", "workflow"],
		where: { repository: 1, workflow: { in: [null, "build"] } },
	},
	{
		groups: 2,
		matches: (run: LatestRun) => (run.repository === 3 && run.workflow === "build") || (run.repository === 1 && run.workflow === "deploy"),
		name: "a tupleIn with reordered fields and a duplicate tuple",
		partitionBy: ["repository", "workflow"],
		where: tupleIn(
			LatestRun,
			["workflow", "repository"],
			[
				["build", 3],
				["deploy", 1],
				["build", 3],
			],
		),
	},
	{
		groups: 2,
		matches: (run: LatestRun) => (run.repository === 2 && run.workflow === null) || (run.repository === 1 && run.workflow === "build"),
		name: "a tupleIn holding a null workflow",
		partitionBy: ["repository", "workflow"],
		where: tupleIn(
			LatestRun,
			["repository", "workflow"],
			[
				[2, null],
				[1, "build"],
			],
		),
	},
] as const;

for (const { groups, matches, name, partitionBy, where } of pins) {
	queries.it(
		`latestPerGroup pinned by ${name} returns the newest twenty runs of each pinned group, as the full ranking does`,
		[indexedRuns()],
		function* ({ latestRuns }) {
			const ranked = yield* latestRuns({ ...newestTwenty, partitionBy });
			const rankedOfPinnedGroups = Array.isArray(ranked) ? ranked.filter(matches) : [];
			expect(rankedOfPinnedGroups).toHaveLength(20 * groups);

			const pinned = yield* latestRuns({ ...newestTwenty, partitionBy, where });

			expect(pinned).toEqual(rankedOfPinnedGroups);
		},
	);

	queries.it(
		`latestPerGroup pinned by ${name} walks each group's index only as far as twenty runs, without a window ranking`,
		[indexedRuns()],
		function* ({ latestRuns, readPlan }) {
			yield* latestRuns({ ...newestTwenty, partitionBy, where });

			expect(yield* readPlan()).toEqual({ rankedByWindow: false, rowsRead: 20 * groups, scans: ["Index Scan"] });
		},
	);
}

const emptyPins = [
	{ name: "an empty in list", where: { repository: { in: [] } } },
	{ name: "an empty in list beside an equality pin", where: { repository: 1, status: { in: [] } } },
	{ name: "an empty tupleIn", where: tupleIn(LatestRun, ["repository", "workflow"], []) },
] as const;

for (const { name, where } of emptyPins) {
	queries.it(
		`latestPerGroup pinned by ${name} returns no runs without sending SQL`,
		[indexedRuns()],
		function* ({ lastResult, latestRuns, statementsSent }) {
			yield* latestRuns({ ...newestTwenty, partitionBy: ["repository"], where });

			yield* outcomes({
				"latest runs": [lastResult(), []],
				"statements sent": [statementsSent(), 0],
			});
		},
	);
}

queries.it("latestPerGroup fails with a schema error on a pin its numeric field cannot encode", [], function* ({ latestRuns }) {
	const latest = yield* latestRuns({ ...newestTwenty, partitionBy: ["repository"], where: { repository: Number.NaN } });

	expect(latest).toBe("failed with a schema error");
});

const negativeLimits = [
	{ name: "ranked", where: {} },
	{ name: "pinned", where: { repository: 1 } },
] as const;

for (const { name, where } of negativeLimits) {
	queries.it(`a ${name} latestPerGroup fails with a schema error on a negative limit`, [], function* ({ latestRuns }) {
		const latest = yield* latestRuns({ ...newestTwenty, limit: -1, partitionBy: ["repository"], where });

		expect(latest).toBe("failed with a schema error");
	});
}

const latestThreePerWorkflow = { limit: 3, orderBy: [{ direction: "desc", field: "id" }], partitionBy: ["repository", "workflow"] } as const;

const completed = { repository: 1, status: "completed" } as const;

queries.it(
	"latestPerGroup pinned on the repository alone still ranks each workflow of it, keeping the newest three completed runs per workflow",
	[indexedRuns()],
	function* ({ latestRuns }) {
		const latest = yield* latestRuns({ ...latestThreePerWorkflow, where: { repository: 1, status: "completed" } });

		expect(latest).toEqual([
			{ ...completed, id: 3000, workflow: "build" },
			{ ...completed, id: 2998, workflow: "build" },
			{ ...completed, id: 2996, workflow: "build" },
			{ ...completed, id: 6000, workflow: "deploy" },
			{ ...completed, id: 5998, workflow: "deploy" },
			{ ...completed, id: 5996, workflow: "deploy" },
			{ ...completed, id: 9000, workflow: null },
			{ ...completed, id: 8998, workflow: null },
			{ ...completed, id: 8996, workflow: null },
		]);
	},
);

queries.it(
	"latestPerGroup pinned on every partition field filters by status before keeping the newest three runs",
	[indexedRuns()],
	function* ({ latestRuns }) {
		const latest = yield* latestRuns({ ...latestThreePerWorkflow, where: { repository: 1, status: "completed", workflow: null } });

		expect(latest).toEqual([
			{ ...completed, id: 9000, workflow: null },
			{ ...completed, id: 8998, workflow: null },
			{ ...completed, id: 8996, workflow: null },
		]);
	},
);
