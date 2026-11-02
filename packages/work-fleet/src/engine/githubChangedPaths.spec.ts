import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { BASE, HEAD, PR, REPORT } from "#test/githubResult.ts";
import { prepared } from "#test/preparation.ts";

for (const { reported, listed, actual } of [
	{ actual: 14, listed: 180, reported: 791 },
	{ actual: 180, listed: 100, reported: 180 },
	{ actual: 14, listed: 180, reported: 14 },
]) {
	const listing = Array.from({ length: listed }, (_, index) => ({ filename: `main/file-${index}.ts` }));
	const comparison = Array.from({ length: actual }, (_, index) => ({ filename: `src/work-${index}.ts` }));
	isolatedEngine.it(
		`a base-merged PR reporting ${reported} files and listing ${listed} adopts its ${actual} comparison files including rename sources`,
		[
			githubPullRequest({
				changedFiles: reported,
				comparison: { files: [{ ...comparison[0], filename: "src/work-0.ts", "previous_filename": "src/old.ts" }, ...comparison.slice(1)] },
				filePages: listed > 100 ? [listing.slice(0, 100), listing.slice(100)] : [listing],
			}),
			reviewerStillRunning(),
		],
		function* ({ fleet, workerReports, githubRequests, publishedDecisions }) {
			yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src"] }), prompt: "Implement one", workId: "one" });
			yield* fleet.dispatch("one");
			workerReports(REPORT);

			const adopted = (yield* fleet.reconcile("one")).value;

			expect(adopted.result).toEqual({
				head: HEAD,
				kind: "change",
				paths: ["src/old.ts", ...Array.from({ length: actual }, (_, index) => `src/work-${index}.ts`)],
				pr: PR,
				prNumber: 7,
			});
			expect(adopted.step).toBe("reviewing");
			expect(adopted.integrationRetry).toBeUndefined();
			expect(publishedDecisions()).toEqual([]);
			expect(githubRequests()).toContain(`/repos/example/repository/compare/${BASE}...${HEAD}?per_page=1`);
		},
		{ clock: "live" },
	);
}

const pagedFiles = Array.from({ length: 205 }, (_, index) => ({ filename: `src/page-${index}.ts` }));
isolatedEngine.it(
	"adopts every changed path from a PR listing spanning three HTTP pages",
	[
		githubPullRequest({ changedFiles: 205, filePages: [pagedFiles.slice(0, 100), pagedFiles.slice(100, 200), pagedFiles.slice(200)] }),
		reviewerStillRunning(),
	],
	function* ({ fleet, workerReports }) {
		yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src"] }), prompt: "Implement one", workId: "one" });
		yield* fleet.dispatch("one");
		workerReports(REPORT);

		const adopted = (yield* fleet.reconcile("one")).value;

		expect(adopted.result).toMatchObject({ paths: Array.from({ length: 205 }, (_, index) => `src/page-${index}.ts`) });
	},
	{ clock: "live" },
);

for (const [reason, comparison] of [
	["reaches GitHub's 300-file cap", { files: Array.from({ length: 300 }, (_, index) => ({ filename: `src/file-${index}.ts` })) }],
	["omits files", {}],
	["duplicates paths", { files: [{ filename: "src/one.ts" }, { filename: "src/one.ts" }] }],
] as const) {
	isolatedEngine.it(
		`a truncated PR listing whose comparison ${reason} publishes one decision with both counts without retrying`,
		[githubPullRequest({ changedFiles: 791, comparison, filePages: [[{ filename: "src/one.ts" }]] }), reviewerStillRunning()],
		function* ({ fleet, prepareWork, workerReports, publishedDecisions, githubRequests, restart, schedule }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);

			const refused = (yield* fleet.reconcile("one")).value;

			expect(refused).toMatchObject({ step: "waiting" });
			expect(refused.result).toBeUndefined();
			expect(refused.integrationRetry).toBeUndefined();
			expect(refused.decision?.reason).toContain(
				"GitHub returned an incomplete changed-path observation: PR reports 791 changed files; /files lists 1",
			);
			expect(publishedDecisions()).toEqual([refused.decision?.reason]);
			const requests = githubRequests();

			yield* restart();
			yield* schedule();

			expect(githubRequests()).toEqual(requests);
			expect(publishedDecisions()).toEqual([refused.decision?.reason]);
		},
		{ clock: "live" },
	);
}
