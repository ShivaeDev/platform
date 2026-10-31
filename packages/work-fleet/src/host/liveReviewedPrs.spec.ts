import { expect } from "vitest";
import { HEAD } from "#test/githubResult.ts";
import { advisoryReview, liveMergeDaemon } from "#test/liveMergeDaemon.ts";

for (const verdict of ["approve", "changes", "unavailable"] as const) {
	liveMergeDaemon.it(
		`queues a green PR after a live ${verdict} review and reports waiting on automation`,
		verdict === "approve" ? [] : [advisoryReview],
		function* (daemon) {
			const worker = yield* daemon.dispatch("one");
			daemon.finishTurn(worker);
			const reviewing = yield* daemon.reconcile("one");
			expect(daemon.queuedPullRequests()).toEqual([]);

			daemon.finishTurn(
				reviewing,
				verdict === "unavailable"
					? "Review unavailable: FLEET_REVIEW: invalid JSON"
					: `FLEET_REVIEW: ${JSON.stringify({ evidence: ["Inspected exact diff"], findings: [], head: HEAD, verdict })}`,
			);
			yield* daemon.startScheduler();
			const queued = yield* daemon.awaitQueued();

			expect(queued).toMatchObject({
				attentionOwner: "automation",
				checks: { head: HEAD, passed: true },
				mergeQueue: { head: HEAD, status: "queued" },
				step: "waiting",
			});
			expect(queued.decision).toBeUndefined();
			expect(daemon.queuedPullRequests()).toEqual([["1", HEAD]]);
			expect(daemon.queueRequests().map((request) => request.variables)).toEqual([{ head: HEAD, pr: "1" }]);
			const status = yield* daemon.status();
			expect(status.waiting.automation).toMatchObject([{ workId: "one" }]);
			expect(status.waiting.orchestrator).toEqual([]);
		},
	);
}
