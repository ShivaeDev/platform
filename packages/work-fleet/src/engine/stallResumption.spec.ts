import { expect } from "vitest";
import { workerReportsChangedPaths } from "#test/engineAdoptionTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { HEAD, PR, REPORT } from "#test/githubResult.ts";
import { nativeStalledTurn } from "#test/nativeStalledTurn.ts";

for (const activity of ["event", "completion"] as const) {
	for (const result of ["pr", "question"] as const) {
		isolatedEngine.it(
			`a stalled worker resumes on ${activity} and delivers its ${result}`,
			[nativeStalledTurn(), workerReportsChangedPaths()],
			function* ({ advanceTime, fleet, prepareWork, emitProviderEvent, completeNativeTurn, acknowledgements, nativeRequests }) {
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				yield* fleet.reconcile("one");
				advanceTime(30 * 60_000);
				const stalled = yield* fleet.reconcile("one");
				expect(stalled.value.decision?.code).toBe("session-stalled");
				advanceTime(60_000);
				if (activity === "event") {
					emitProviderEvent();
					const resumed = yield* fleet.reconcile("one");
					expect(resumed.value.step).toBe("working");
					expect(resumed.value.decision).toBeUndefined();
					expect(resumed.value.attempts[0]?.sessionUnusable).toBeUndefined();
					expect(acknowledgements()).toMatchObject([{ decision: stalled.value.decision?.published, disposition: "superseded" }]);
				}
				const output = result === "pr" ? REPORT : "FLEET_QUESTION: Which storage should I use?";
				completeNativeTurn("turn-1", output);
				const delivered = yield* fleet.reconcile("one");
				expect(delivered.value.attempts[0]?.output).toBe(output);
				expect(delivered.value.attempts[0]?.status).toBe("completed");
				if (result === "pr") {
					expect(delivered.value.result).toMatchObject({ head: HEAD, kind: "change", pr: PR });
					expect(delivered.value.step).toBe("reviewing");
					expect(delivered.value.decision).toBeUndefined();
				} else {
					expect(delivered.value.decision).toMatchObject({ code: "worker-question", reason: "Which storage should I use?" });
					expect(delivered.value.decision?.id).not.toBe(stalled.value.decision?.id);
				}
				expect(acknowledgements()).toMatchObject([{ decision: stalled.value.decision?.published, disposition: "superseded" }]);
				expect(delivered.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: stalled.value.decision?.published }]);
				expect(nativeRequests().filter(({ method }) => method === "turn/interrupt")).toEqual([]);
			},
		);
	}
}
