import { expect } from "@effect/vitest";
import { noChecksRequired, optionalCheckFails, requiredChecksFailInSequence } from "#test/engineCheckTraits.ts";
import { engine } from "#test/engineStory.ts";
import { ADOPTED_HEAD } from "#test/githubChecks.ts";

for (const pending of [false, true]) {
	engine.it(
		`a ${pending ? "pending" : "failing"} optional app leaves required checks green for review and completion`,
		[optionalCheckFails(pending)],
		function* ({ fleet, prepareWork, finishWorkers, providerStarts }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();

			const completed = yield* fleet.reconcile("one");

			const reviewer = providerStarts().find((start) => start.access === "read-only");
			expect(reviewer?.prompt).toContain('"passed":true');
			expect(completed.value.step).toBe("done");
			expect(completed.value.checks).toMatchObject({ head: ADOPTED_HEAD, passed: true, pending: false });
			expect(completed.value.attempts.map((attempt) => attempt.role)).toEqual(["worker", "reviewer"]);
		},
	);
}
for (const empty of [false, true]) {
	engine.it(
		`${empty ? "absent checks" : "a failing optional app"} cannot gate completion when GitHub requires no checks`,
		[noChecksRequired(empty)],
		function* ({ fleet, prepareWork, finishWorkers }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();

			const completed = yield* fleet.reconcile("one");

			expect(completed.value.step).toBe("done");
			expect(completed.value.attempts.map((attempt) => attempt.role)).toEqual(["worker", "reviewer"]);
		},
	);
}
for (const branchProtection of [false, true]) {
	engine.it(
		`a failing ${branchProtection ? "branch protection" : "ruleset"} required check starts repair on the worker thread`,
		[requiredChecksFailInSequence(branchProtection)],
		function* ({ fleet, prepareWork, finishWorkers }) {
			yield* prepareWork("one");
			const working = yield* fleet.dispatch("one");
			finishWorkers();

			const repairing = yield* fleet.reconcile("one");

			expect(repairing.value.attempts.at(-1)).toMatchObject({
				checkFailures: ["verify"],
				receipt: { sessionId: working.value.attempts[0]?.receipt?.sessionId },
				role: "repair",
			});
			expect(repairing.value.step).toBe("working");
		},
	);
}
