import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { pendingAcknowledgements } from "#engine/pendingAcknowledgements.ts";
import { noChangeHost } from "#test/hostScenarioTraits.ts";
import { approvedWork, host } from "#test/hostStory.ts";
import { unavailableAcknowledgements } from "#test/unavailableAcknowledgements.ts";

for (const release of [false, true]) {
	host.it(
		`a stale question acknowledgement clears when work is ${release ? "released" : "completed"}, including CLI status and watch`,
		[approvedWork(["one"]), noChangeHost, unavailableAcknowledgements],
		function* (daemon) {
			const started = yield* daemon.dispatch("one");
			expect(started.step).toBe("working");
			daemon.finishTurn(started, "FLEET_QUESTION: Which storage?");
			const waiting = yield* daemon.reconcile("one");
			const published = waiting.decision?.published ?? (yield* Effect.die("Missing published question"));
			const answered = yield* daemon.answer("one", "Use PostgreSQL.", release);
			expect(answered.blocker).toContain("Board request acknowledgement pending");
			expect(pendingAcknowledgements(answered)).toMatchObject([{ input: { decision: published, disposition: "applied" } }]);
			const response = answered.responses?.[0] ?? (yield* Effect.die("Missing recorded answer"));
			const responseFile = `responses/${response.responseId}.md`;
			const history = daemon.readBoard(responseFile);
			daemon.supersedeQuestion(published, response.responseId, release);
			daemon.acknowledgementsAvailable();
			daemon.finishWorkers();
			const completed = yield* daemon.reconcile("one");
			expect(completed.step).toBe(release ? "released" : "done");
			expect(completed.blocker).toBeUndefined();
			expect(completed.responses).toEqual([
				{ ...response, ...(release ? { boardAcknowledged: true } : {}), boardAcknowledgementDisposition: "superseded" },
			]);
			expect(pendingAcknowledgements(completed)).toEqual([]);
			expect(daemon.readBoard(responseFile)).toBe(history);
			expect(daemon.boardAcknowledgements()).toMatchObject(release ? [{ disposition: "superseded", question: published.questionId }] : []);
			const previousAttempts = daemon.acknowledgementAttempts();
			yield* daemon.reconcile("one");
			expect(daemon.acknowledgementAttempts()).toBe(previousAttempts);
			const status = yield* daemon.cli(["status"]);
			expect(status.code).toBe(0);
			expect(status.stdout).toContain("Waiting on orchestrator (0)");
			expect(status.stdout).not.toContain("acknowledgement pending");
			if (!release) {
				expect(status.stdout).toContain("Done (1)\n  one  done");
			}
			yield* daemon.follow("completed", "watch", ["one"]);
			const watched = yield* daemon.followerExit("completed");
			expect(watched.code).toBe(0);
			expect(watched.stdout).toBe(release ? "one released" : "one done: Existing behavior meets acceptance criteria");
		},
	);
}
