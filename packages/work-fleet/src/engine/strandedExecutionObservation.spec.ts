import { expect } from "@effect/vitest";
import { executing } from "#model.ts";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest, reviewerStillRunning } from "#test/engineTraits.ts";
import { HEAD, REPORT } from "#test/githubResult.ts";

for (const step of ["queued", "adopting", "reviewing", "repairing", "validating", "delivering"] as const) {
	for (const status of ["submitting", "accepted", "running"] as const) {
		engine.it(`restart reconciles a legacy ${status} attempt stranded in ${step}`, [], function* (fleet) {
			yield* fleet.prepareWork("one");
			if (status === "submitting") {
				fleet.loseNextAcknowledgement();
			}
			const dispatched = yield* fleet.dispatch("one");
			// Older daemons could persist execution outside the working step.
			yield* fleet.replaceStoredRecord({
				...dispatched.value,
				attempts: dispatched.value.attempts.map((attempt) => ({ ...attempt, status })),
				step,
			});
			fleet.finishWorkers();
			yield* fleet.restart();
			const reconciled = yield* fleet.reconcile("one");
			expect(reconciled.value.step).toBe("done");
			expect(reconciled.value.attempts[0]).toMatchObject({ receipt: { turnId: expect.any(String) }, status: "completed" });
			expect(executing(reconciled.value)).toBe(false);
			expect(
				fleet
					.providerCalls()
					.filter((call) => call.operationId === dispatched.value.attempts[0]?.operationId)
					.map((call) => call.call),
			).toEqual(["session", "turn"]);
		});
	}
}

engine.it(
	"restart reconciles a reviewer stranded in delivery through independent review",
	[githubPullRequest(), reviewerStillRunning()],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.workerReports(REPORT);
		const reviewing = yield* fleet.reconcile("one");
		yield* fleet.replaceStoredRecord({ ...reviewing.value, step: "delivering" });
		fleet.finishWorkers();
		yield* fleet.restart();
		const reconciled = yield* fleet.reconcile("one");
		expect(reconciled.value.decision?.code).toBe("reviewed-pr-ready");
		expect(reconciled.value.review).toMatchObject({ head: HEAD, verdict: "approved" });
		expect(executing(reconciled.value)).toBe(false);
	},
);
