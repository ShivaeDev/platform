import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { workerReportsChangedPaths } from "#test/engineAdoptionTraits.ts";
import { launchDefaults } from "#test/engineLaunchTraits.ts";
import { boardAcknowledgementFailsOnce, workerGuidance } from "#test/engineLifecycleTraits.ts";
import { engine } from "#test/engineStory.ts";
import { workerReportsCanBeAdopted } from "#test/engineWorkerReportTraits.ts";
import { HEAD, NO_CHANGE, PR, REPORT } from "#test/githubResult.ts";

describe("worker report correction through PostgreSQL", () => {
	for (const malformed of [
		`FLEET_PR: ${PR}`,
		`FLEET_HEAD: short\nFLEET_PR: ${PR}`,
		`${REPORT}\nText after the PR line`,
		`FLEET_HEAD: ${HEAD}\nFLEET_PR: invalid`,
	]) {
		engine.it(
			`corrects a malformed report on the same worker thread: ${JSON.stringify(malformed)}`,
			[
				workerReportsChangedPaths(),
				launchDefaults({ effort: "high", model: "host-model" }),
				workerGuidance("Follow synthetic repository conventions."),
			],
			function* ({ githubRequests, workerReportReply, fleet, prepareWork, afterRestart, launches, reviewedHeads }) {
				yield* prepareWork("one");
				const dispatched = yield* fleet.dispatch("one");
				const original = yield* workerReportReply(dispatched, malformed);
				const followUp = yield* fleet.reconcile("one");
				const attempt = followUp.value.attempts.at(-1);
				expect(followUp.value.step).toBe("working");
				expect(followUp.value.decision).toBeUndefined();
				expect(followUp.value.result).toBeUndefined();
				expect(followUp.value.attempts).toHaveLength(2);
				expect(attempt).toMatchObject({ role: "worker", sessionId: original.sessionId, settings: { effort: "high", model: "host-model" } });
				expect(attempt?.receipt?.turnId).not.toBe(original.turnId);
				expect(attempt?.prompt).toContain("Reply only with a corrected report");
				expect(attempt?.prompt).toContain("Follow synthetic repository conventions.");
				expect(attempt?.prompt).toContain("full 40-character head SHA");
				expect(attempt?.prompt).toContain("FLEET_HEAD: <sha>\nFLEET_PR: <url or none>");
				expect(followUp.value.attempts[0]?.output).toBe(malformed);
				expect(githubRequests()).toHaveLength(0);
				yield* workerReportReply(followUp, REPORT);
				const reviewing = yield* afterRestart(Effect.flatMap(Fleet, (resumed) => resumed.reconcile("one")));
				expect(reviewing.value.step).toBe("reviewing");
				expect(reviewing.value.result).toMatchObject({ head: HEAD, kind: "change", pr: PR });
				expect(reviewedHeads()).toEqual([HEAD]);
				expect(launches()).toHaveLength(2);
			},
		);
	}
	engine.it(
		"a second malformed reply needs a human and retry starts a new correction turn",
		[boardAcknowledgementFailsOnce(), workerReportsCanBeAdopted(), workerGuidance("Follow synthetic repository conventions.")],
		function* ({ workerReportReply, fleet, prepareWork, afterRestart, respond, publishedDecisions, providerCalls, reviewedHeads, acknowledgements }) {
			yield* prepareWork("one");
			const dispatched = yield* fleet.dispatch("one");
			const original = yield* workerReportReply(dispatched, "Missing report");
			const followUp = yield* fleet.reconcile("one");
			yield* workerReportReply(followUp, `FLEET_PR: ${PR}`);

			const blocked = yield* afterRestart(Effect.flatMap(Fleet, (restarted) => restarted.reconcile("one")));
			expect(blocked.value.step).toBe("waiting");
			expect(blocked.value.decision?.reason).toContain("FLEET_HEAD");
			expect(blocked.value.attempts).toHaveLength(2);
			expect(blocked.value.result).toBeUndefined();
			expect(blocked.value.outcome).toBeUndefined();
			expect(reviewedHeads()).toHaveLength(0);
			expect((yield* fleet.reconcile("one")).value.attempts).toHaveLength(2);
			const decisionId = blocked.value.decision?.id ?? "missing";
			const responseId = respond(decisionId, "retry");
			const retry = yield* fleet.resolve("one", decisionId, responseId);
			expect(retry.value.step).toBe("working");
			expect(retry.value.decision).toBeUndefined();
			expect(retry.value.attempts).toHaveLength(3);
			expect(retry.value.attempts.at(-1)?.prompt).toBe(followUp.value.attempts.at(-1)?.prompt);
			expect(retry.value.attempts.at(-1)?.receipt?.sessionId).toBe(original.sessionId);
			expect(retry.value.attempts.at(-1)?.receipt?.turnId).not.toBe(followUp.value.attempts.at(-1)?.receipt?.turnId);
			const repeated = yield* afterRestart(Effect.flatMap(Fleet, (restarted) => restarted.resolve("one", decisionId, responseId)));
			expect(repeated.value.attempts).toHaveLength(3);
			expect(repeated.value.responses?.[0]?.boardAcknowledged).toBe(true);
			expect(acknowledgements()).toHaveLength(1);
			expect(publishedDecisions()).toHaveLength(1);
			yield* workerReportReply(repeated, NO_CHANGE);
			const completed = yield* fleet.reconcile("one");
			expect(completed.value.step).toBe("done");
			expect(completed.value.result).toMatchObject({ head: HEAD, kind: "no-change" });
			expect(completed.value.review?.head).toBe(HEAD);
			expect(completed.value.checks).toMatchObject({ head: HEAD, passed: true });
			expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(4);
		},
	);
});
