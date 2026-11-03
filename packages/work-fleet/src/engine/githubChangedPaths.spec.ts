import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { HEAD, PR, REPORT } from "#test/githubResult.ts";
import { localChangedPaths } from "#test/localChangedPaths.ts";
import { prepared } from "#test/preparation.ts";

for (const { reported, listed, actual } of [
	{ actual: 14, listed: 180, reported: 791 },
	{ actual: 180, listed: 100, reported: 180 },
	{ actual: 396, listed: 396, reported: 791 },
	{ actual: 3101, listed: 3000, reported: 3000 },
]) {
	const directory = actual > 3000 ? `src/${"nested".repeat(30)}/${"nested".repeat(30)}` : "src";
	const paths = Array.from({ length: actual }, (_, index) => `${directory}/work-${index}.ts`);
	isolatedEngine.it(
		`a PR reporting ${reported} files and listing ${listed} adopts every local path across ${actual} additions, a rename and a deletion`,
		[localChangedPaths(paths, reported, listed), reviewerStillRunning()],
		function* ({ fleet, workerReports, currentPullRequestHead, githubRequests, publishedDecisions }) {
			yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src"] }), prompt: "Implement one", workId: "one" });
			yield* fleet.dispatch("one");
			const head = currentPullRequestHead();
			workerReports(REPORT.replace(HEAD, head));

			const adopted = (yield* fleet.reconcile("one")).value;

			expect(adopted.result).toEqual({
				head,
				kind: "change",
				paths: ["src/deleted.ts", "src/old.ts", "src/renamed\tfile.ts", ...paths].sort((left, right) => left.localeCompare(right)),
				pr: PR,
				prNumber: 7,
			});
			expect(adopted.step).toBe("reviewing");
			expect(adopted.integrationRetry).toBeUndefined();
			expect(publishedDecisions()).toEqual([]);
			expect(githubRequests().filter((path) => path.includes("/compare/"))).toEqual([]);
		},
		{ clock: "live" },
	);
}

const pagedFiles = Array.from({ length: 396 }, (_, index) => ({ filename: `src/page-${index}.ts` }));
isolatedEngine.it(
	"adopts every changed path from a 396-file PR listing spanning four HTTP pages without a local checkout",
	[
		githubPullRequest({
			changedFiles: 396,
			filePages: [pagedFiles.slice(0, 100), pagedFiles.slice(100, 200), pagedFiles.slice(200, 300), pagedFiles.slice(300)],
		}),
		reviewerStillRunning(),
	],
	function* ({ fleet, workerReports }) {
		yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src"] }), prompt: "Implement one", workId: "one" });
		yield* fleet.dispatch("one");
		workerReports(REPORT);

		const adopted = (yield* fleet.reconcile("one")).value;

		expect(adopted.result).toMatchObject({ paths: Array.from({ length: 396 }, (_, index) => `src/page-${index}.ts`) });
		expect(adopted.step).toBe("reviewing");
	},
	{ clock: "live" },
);

isolatedEngine.it(
	"an incomplete PR listing and a failed local read publish one decision with both counts without retrying",
	[localChangedPaths(["src/work.ts"], 791, 1, true), reviewerStillRunning()],
	function* ({ fleet, prepareWork, workerReports, currentPullRequestHead, publishedDecisions, githubRequests, restart, schedule }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		workerReports(REPORT.replace(HEAD, currentPullRequestHead()));

		const refused = (yield* fleet.reconcile("one")).value;

		expect(refused).toMatchObject({ step: "waiting" });
		expect(refused.result).toBeUndefined();
		expect(refused.integrationRetry).toBeUndefined();
		expect(refused.decision?.reason).toContain(
			"GitHub returned an incomplete changed-path observation: PR reports 791 changed files; /files lists 1; local base/head comparison failed:",
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
