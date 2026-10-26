import { expect } from "@effect/vitest";
import { stalledRole } from "#test/engineStalledTurnTraits.ts";
import { engine } from "#test/engineStory.ts";

for (const role of ["repair", "reviewer"] as const) {
	engine.it(
		`a stalled ${role} retries in a fresh session with its original role and PR`,
		[stalledRole(role)],
		function* ({ advanceTime, fleet, prepareWork, finishWorkers, afterRestart, respond, providerStarts }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			yield* fleet.reconcile("one");
			advanceTime(31 * 60_000);
			yield* fleet.reconcile("one");
			const stalled = yield* fleet.get("one");
			expect(stalled.value.decision?.code).toBe("session-stalled");
			const previous = stalled.value.attempts.at(-1);
			expect(previous?.role).toBe(role);
			const decisionId = stalled.value.decision?.id ?? "missing";
			yield* afterRestart(fleet.resolve("one", decisionId, respond(decisionId, "retry")));
			yield* afterRestart(fleet.reconcile("one"));
			const retried = yield* afterRestart(fleet.reconcile("one"));
			expect(retried.value.attempts).toHaveLength(stalled.value.attempts.length + 1);
			expect(retried.value.attempts.at(-1)).toMatchObject({ role, status: "running" });
			expect(retried.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(previous?.receipt?.sessionId);
			expect(retried.value.result).toEqual(stalled.value.result);
			if (role === "reviewer") {
				expect(providerStarts().at(-1)?.access).toBe("read-only");
				expect(retried.value.attempts.at(-1)?.reviewHead).toBe(previous?.reviewHead);
			} else {
				expect(providerStarts().at(-1)?.prompt).toContain("same branch and PR");
			}
		},
	);
}
