import { describe, expect } from "@effect/vitest";
import { engine } from "#test/engineStory.ts";
import { reviewerStillRunning, reviewerUsesHostSettings, reviewFollowUpAcknowledgementLost } from "#test/engineTraits.ts";

const approval = `FLEET_REVIEW: ${JSON.stringify({
	evidence: ["Read the diff at head-one-0", "Required checks passed at head-one-0", "CI job logs and artifacts unavailable: HTTP 403"],
	findings: [],
	head: "head-one-0",
	verdict: "approve",
})}`;
describe("reviewer evidence and verdict follow-up", () => {
	engine.it(
		"accepts approval citing unavailable logs and passing exact-head checks",
		[reviewerStillRunning()],
		function* ({ fleet, prepareWork, finishWorkers, turnReports, launches }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const reviewing = yield* fleet.reconcile("one");
			const receipt = yield* turnReports(reviewing, approval);
			const completed = yield* fleet.reconcile("one");
			expect(completed.value.step).toBe("done");
			expect(completed.value.review).toMatchObject({ receipt, verdict: "approved" });
			expect(completed.value.review?.evidence).toContain("CI job logs and artifacts unavailable: HTTP 403");
			expect(completed.value.checks).toMatchObject({ head: "head-one-0", passed: true });
			expect(launches()).toHaveLength(2);
		},
	);
	for (const malformed of ["Cannot see CI job logs: HTTP 403", "FLEET_REVIEW: invalid"]) {
		engine.it(
			`continues the same reviewer thread once to fix ${JSON.stringify(malformed)}`,
			[reviewerStillRunning(), reviewerUsesHostSettings({ effort: "high", model: "host-model" })],
			function* ({ fleet, prepareWork, finishWorkers, restart, turnReports, launches }) {
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers();
				const reviewing = yield* fleet.reconcile("one");
				const original = yield* turnReports(reviewing, malformed);
				const followUp = yield* fleet.reconcile("one");
				const attempt = followUp.value.attempts.at(-1);
				expect(followUp.value.step).toBe("reviewing");
				expect(followUp.value.decision).toBeUndefined();
				expect(followUp.value.review).toBeUndefined();
				expect(attempt).toMatchObject({ reviewHead: "head-one-0", role: "reviewer", sessionId: original.sessionId });
				expect(attempt?.receipt?.turnId).not.toBe(original.turnId);
				expect(attempt?.prompt).toContain("Your previous reply did not contain a parseable verdict");
				expect(attempt?.prompt).toContain("Inspect synthetic database checks.");
				expect(attempt?.prompt).toContain('"verdict":"approve"');
				expect(attempt?.settings).toEqual({ effort: "high", model: "host-model" });
				expect(followUp.value.attempts.at(-2)?.output).toBe(malformed);
				const receipt = yield* turnReports(followUp, approval);
				yield* restart();
				const completed = yield* fleet.reconcile("one");
				expect(completed.value.step).toBe("done");
				expect(completed.value.review).toMatchObject({ receipt, verdict: "approved" });
				expect(launches()).toHaveLength(2);
				expect(completed.value.attempts).toHaveLength(3);
			},
		);
	}
	engine.it(
		"reconciles a lost follow-up acknowledgement on the same thread after restart",
		[reviewerStillRunning(), reviewFollowUpAcknowledgementLost()],
		function* ({ fleet, prepareWork, finishWorkers, restart, turnReports, launches, providerCalls }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const reviewing = yield* fleet.reconcile("one");
			const original = yield* turnReports(reviewing, "No verdict");
			const lost = yield* fleet.reconcile("one");
			const intent = lost.value.attempts.at(-1);
			expect(intent).toMatchObject({ sessionId: original.sessionId, status: "submitting" });
			expect(intent?.receipt).toBeUndefined();
			yield* restart();
			const recovered = yield* fleet.reconcile("one");
			expect(recovered.value.attempts.at(-1)).toMatchObject({ operationId: intent?.operationId, status: "running" });
			const receipt = yield* turnReports(recovered, approval);
			expect(receipt.sessionId).toBe(original.sessionId);
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			expect(launches()).toHaveLength(2);
			expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(3);
		},
	);
	engine.it(
		"a second malformed reply waits on the orchestrator after restart without another follow-up",
		[reviewerStillRunning()],
		function* ({ fleet, prepareWork, finishWorkers, restart, turnReports, mergedHeads, launches }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const reviewing = yield* fleet.reconcile("one");
			const original = yield* turnReports(reviewing, "No verdict");
			const followUp = yield* fleet.reconcile("one");
			const receipt = yield* turnReports(followUp, "FLEET_REVIEW: invalid");
			expect(receipt.sessionId).toBe(original.sessionId);
			yield* restart();
			const invalid = yield* fleet.reconcile("one");
			expect(invalid.value.step).toBe("waiting");
			expect(invalid.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
			expect(invalid.value.decision?.reason).toContain("malformed");
			expect(invalid.value.review).toBeUndefined();
			expect(invalid.value.outcome).toBeUndefined();
			expect(invalid.value.attempts.at(-1)).toMatchObject({ output: "FLEET_REVIEW: invalid", receipt, status: "completed" });
			expect(mergedHeads()).toHaveLength(0);
			const unchanged = yield* fleet.reconcile("one");
			expect(unchanged.value.step).toBe("waiting");
			expect(unchanged.value.outcome).toBeUndefined();
			expect(unchanged.value.attempts).toHaveLength(3);
			expect(launches()).toHaveLength(2);
			expect(invalid.value.attempts).toHaveLength(3);
		},
	);
});
