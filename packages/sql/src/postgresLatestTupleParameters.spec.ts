import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { indexedRuns, queries } from "#test/queries.ts";
import { LatestRun } from "#test/queryModels.ts";
import { tupleIn } from "#tupleIn.ts";

const tuples = Array.from({ length: 50_000 }, (_, index): readonly [string | null, number] => (index === 49_999 ? [null, 2] : ["build", 1]));

queries.it(
	"50,000 tuple pins bind two arrays and one limit while duplicates and a null pin keep one latest row per group",
	[indexedRuns()],
	function* ({ boundParameterCounts, boundParameters, lastResult, latestRuns }) {
		yield* latestRuns({
			limit: 1,
			orderBy: [{ direction: "desc", field: "id" }],
			partitionBy: ["repository", "workflow"],
			where: tupleIn(LatestRun, ["workflow", "repository"], tuples, { repository: "numeric", workflow: "text" }),
		});

		yield* outcomes([
			["bound parameter count", () => boundParameterCounts(), [3]],
			["bound parameters", () => boundParameters(), [[tuples.map(([workflow]) => workflow), tuples.map(([, repository]) => String(repository)), 1]]],
			[
				"latest runs",
				() => lastResult(),
				[
					{ id: 3000, repository: 1, status: "completed", workflow: "build" },
					{ id: 18_000, repository: 2, status: "completed", workflow: null },
				],
			],
		]);
	},
);
