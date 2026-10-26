import type { LatestPerGroup } from "#repository.ts";
import { tupleIn } from "#tupleIn.ts";
import { LatestRun } from "./latestRuns.ts";

interface PinnedCase {
	readonly groups: number;
	readonly matches: (row: LatestRun) => boolean;
	readonly name: string;
	readonly partitionBy: LatestPerGroup<typeof LatestRun>["partitionBy"];
	readonly where: NonNullable<LatestPerGroup<typeof LatestRun>["where"]>;
}
export const latestRunCases: readonly PinnedCase[] = [
	{ groups: 1, matches: (row) => row.repository === 2, name: "encoded equality", partitionBy: ["repository"], where: { repository: 2 } },
	{
		groups: 2,
		matches: (row) => row.repository !== 2,
		name: "an unordered IN list with duplicates",
		partitionBy: ["repository"],
		where: { repository: { in: [3, 1, 3] } },
	},
	{
		groups: 4,
		matches: (row) => row.repository !== 2 && row.workflow !== null,
		name: "composite IN lists",
		partitionBy: ["repository", "workflow"],
		where: { repository: { in: [3, 1] }, workflow: { in: ["deploy", "build"] } },
	},
	{
		groups: 1,
		matches: (row) => row.repository === 1 && row.workflow === null,
		name: "a null partition",
		partitionBy: ["repository", "workflow"],
		where: { repository: 1, workflow: null },
	},
	{
		groups: 2,
		matches: (row) => row.repository === 1 && row.workflow !== "deploy",
		name: "null and non-null IN values",
		partitionBy: ["repository", "workflow"],
		where: { repository: 1, workflow: { in: [null, "build"] } },
	},
	{
		groups: 2,
		matches: (row) => (row.repository === 3 && row.workflow === "build") || (row.repository === 1 && row.workflow === "deploy"),
		name: "reordered tuple fields and duplicate tuples",
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
		matches: (row) => (row.repository === 2 && row.workflow === null) || (row.repository === 1 && row.workflow === "build"),
		name: "nullable tuple values",
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
];
