import { expect } from "@effect/vitest";
import { Effect, Schedule, Stream } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { SessionFailure } from "#session/schema.ts";
import { answers, approvedPullRequest } from "#test/answerHost.ts";

for (const failed of [false, true]) {
	answers.it(`${failed ? "failed" : "pending"} guidance takes precedence over repair provider backoff`, [approvedPullRequest], function* (host) {
		const ready = yield* host.readyPullRequest();
		host.provider.rejectNextTurn(new SessionFailure({ code: "session-queue-full", message: "Provider queue is full", reason: "rejected" }));
		yield* host.answerPullRequest(ready, "Retain the existing layout.");
		const repairing = yield* host.reconcile();
		expect(repairing.stage).toBe("repairing");
		expect(repairing.launchRetry).toBeDefined();
		expect(renderStatus(yield* host.status())).toContain("Waiting for provider capacity");
		if (failed) {
			yield* host.failQueue();
		}
		const free = yield* host.holdAdmission();
		yield* host.answer("Preserve the empty state.");
		if (failed) {
			yield* free;
			yield* host
				.storedRequests()
				.pipe(
					Effect.repeat({ schedule: Schedule.spaced("10 millis"), until: (requests) => requests.some((request) => request.error !== null) }),
					Effect.timeout("5 seconds"),
				);
		}
		const status = yield* host.status();
		const blocker = failed ? expect.stringMatching(/^Answer failed: /u) : ANSWER_RECORDED;
		expect(status.waiting[failed ? "orchestrator" : "automation"]).toMatchObject([{ blocker, stage: "repairing", workId: "one" }]);
		expect(status.waiting[failed ? "automation" : "orchestrator"]).toEqual([]);
		expect(renderStatus(status)).not.toContain("Waiting for provider capacity");
		const snapshots = yield* host.follow(["one"]).pipe(Stream.take(1), Stream.runCollect, Effect.timeout("500 millis"));
		expect(snapshots).toEqual([[expect.objectContaining({ attentionOwner: failed ? "orchestrator" : "automation", blocker, workId: "one" })]]);
		yield* free;
		if (!failed) {
			yield* host.applied();
			expect(renderStatus(yield* host.status())).toContain("Waiting for provider capacity");
		}
		expect((yield* host.get()).launchRetry).toEqual(repairing.launchRetry);
	});
}
