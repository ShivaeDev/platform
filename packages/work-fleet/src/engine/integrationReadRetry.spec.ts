import { expect } from "vitest";
import { statusMarkdown } from "#board/statusMarkdown.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { HEAD, REPORT } from "#test/githubResult.ts";

for (const failures of [1, 5]) {
	isolatedEngine.it(
		`GitHub adoption retries ${failures} failed HTTP reads against the same done worker`,
		[githubPullRequest(), reviewerStillRunning()],
		function* ({
			providerStarts,
			publishedDecisions,
			githubRequests,
			workerReports,
			advanceTime,
			currentTime,
			failGithubReads,
			prepareWork,
			restart,
			fleet,
			schedule,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			failGithubReads(failures);
			const waiting = (yield* fleet.reconcile("one")).value;
			expect(waiting.step).toBe("adopting");
			expect(waiting.decision).toBeUndefined();
			expect(waiting.attentionOwner).toBe("automation");
			expect(waiting.integrationRetry).toMatchObject({ failures: 1, retryAt: 30_100 });
			expect(statusMarkdown([waiting])).toContain(waiting.blocker);
			const reads = githubRequests().length;
			advanceTime(29_999);
			yield* restart();
			yield* schedule();
			expect(githubRequests()).toHaveLength(reads);
			for (let attempt = 2; attempt <= (failures === 1 ? 2 : failures); attempt += 1) {
				const retry = (yield* fleet.get("one")).value.integrationRetry;
				expect(retry).toBeDefined();
				if (retry === undefined) {
					throw new Error("Missing GitHub read retry");
				}
				advanceTime(retry.retryAt - currentTime());
				yield* restart();
				yield* schedule();
				const current = (yield* fleet.get("one")).value;
				if (attempt < failures) {
					expect(current.integrationRetry).toMatchObject({ failures: attempt, retryAt: currentTime() + 30_000 * 2 ** (attempt - 1) });
					expect(current.decision).toBeUndefined();
				}
			}
			const result = (yield* fleet.get("one")).value;
			if (failures === 1) {
				expect(result.step).toBe("reviewing");
				expect(result.result?.head).toBe(HEAD);
				expect(result.integrationRetry).toBeUndefined();
				expect(result.blocker).toBeUndefined();
				expect(result.attentionOwner).toBeUndefined();
				expect(result.decision).toBeUndefined();
				expect(publishedDecisions()).toEqual([]);
			} else {
				expect(result.step).toBe("waiting");
				expect(result.decision?.reason).toContain("read failure after 5 attempts");
				expect(result.decisionPublished).toBe(true);
				expect(publishedDecisions()).toEqual([result.decision?.reason]);
				yield* restart();
				yield* schedule();
				expect((yield* fleet.get("one")).value.decision).toEqual(result.decision);
				expect(publishedDecisions()).toEqual([result.decision?.reason]);
			}
			expect(
				providerStarts()
					.filter((start) => start.access !== "read-only")
					.map((start) => start.operationId),
			).toEqual(["operation-1"]);
		},
		{ clock: "live" },
	);
}
