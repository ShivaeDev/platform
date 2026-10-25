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
	"a repairing record with an executing worker resumes independent review after restart",
	[githubPullRequest(), reviewerStillRunning()],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		const dispatched = yield* fleet.dispatch("one");
		const worker = dispatched.value.attempts[0];
		// Recover a legacy repairing step without replacing its executing worker.
		yield* fleet.replaceStoredRecord({ ...dispatched.value, step: "repairing" });
		yield* fleet.restart();
		const restored = yield* fleet.get("one");
		expect(restored.value.step).toBe("repairing");
		expect(executing(restored.value)).toBe(true);
		fleet.workerReports(REPORT);
		const reviewing = yield* fleet.reconcile("one");
		expect(reviewing.value.step).toBe("reviewing");
		expect(reviewing.value.decision).toBeUndefined();
		expect(reviewing.value.attempts).toMatchObject([
			{ operationId: worker?.operationId, receipt: worker?.receipt, role: "worker", status: "completed" },
			{ role: "reviewer", status: "running" },
		]);
		expect(fleet.providerStarts().map(({ access }) => access)).toEqual([undefined, "read-only"]);
		fleet.finishWorkers();
		const ready = yield* fleet.reconcile("one");
		expect(ready.value.decision?.code).toBe("reviewed-pr-ready");
		expect(ready.value.review).toMatchObject({ head: HEAD, verdict: "approved" });
	},
);

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
