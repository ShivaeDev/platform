import { expect } from "vitest";
import { ciPathsObserved } from "#test/ciPathsObserved.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { REPORT } from "#test/githubResult.ts";
import { prepared } from "#test/preparation.ts";

const paths = Array.from({ length: 143 }, (_, index) => `src/work-${index}.ts`);
const paginatedPullRequest = githubPullRequest({
	changedFiles: 143,
	filePages: [paths.slice(0, 100).map((filename) => ({ filename })), paths.slice(100).map((filename) => ({ filename }))],
});

isolatedEngine.it(
	"a complete 143-file PR proceeds to review when CI-path revalidation omits Link headers",
	[paginatedPullRequest, ciPathsObserved, reviewerStillRunning()],
	function* ({ fleet, workerReports, publishedDecisions }) {
		yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src"] }), prompt: "Implement one", workId: "one" });
		yield* fleet.dispatch("one");
		workerReports(REPORT);

		const observed = (yield* fleet.reconcile("one")).value;

		expect(observed.result).toMatchObject({ paths });
		expect(observed.step).toBe("reviewing");
		expect(observed.integrationRetry).toBeUndefined();
		expect(publishedDecisions()).toEqual([]);
	},
	{ clock: "live" },
);

isolatedEngine.it(
	"a genuinely incomplete CI-path observation still publishes the integration failure after five attempts",
	[paginatedPullRequest, ciPathsObserved, reviewerStillRunning()],
	function* ({ fleet, workerReports, omitLastChangedFile, advanceTime, currentTime, publishedDecisions }) {
		yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src"] }), prompt: "Implement one", workId: "one" });
		yield* fleet.dispatch("one");
		workerReports(REPORT);
		expect((yield* fleet.reconcile("one")).value.step).toBe("reviewing");
		omitLastChangedFile();

		for (let attempt = 1; attempt <= 5; attempt += 1) {
			const observed = (yield* fleet.reconcile("one")).value;
			if (observed.integrationRetry !== undefined) {
				advanceTime(observed.integrationRetry.retryAt - currentTime());
			}
		}

		const failed = (yield* fleet.get("one")).value;
		expect(failed.step).toBe("waiting");
		expect(failed.decision?.reason).toBe(
			"GitHub returned an incomplete changed-path observation; integration read failure after 5 attempts (4 automatic retries); execution ownership retained",
		);
		expect(publishedDecisions()).toEqual([failed.decision?.reason]);
	},
	{ clock: "live" },
);
