import { describe, expect } from "@effect/vitest";
import { cycle } from "#engine/scheduler.ts";
import { providerCapacityRejected } from "#test/engineCapacityTraits.ts";
import { reviewAndChecksRequestRepairs, workerGuidance } from "#test/engineLifecycleTraits.ts";
import { engine } from "#test/engineStory.ts";

const GUIDANCE = "Follow synthetic repository conventions.\nVerify changes locally.";

describe("worker guidance through PostgreSQL", () => {
	for (const guidance of [undefined, GUIDANCE]) {
		engine.it(
			`first turns, repairs and manual continuations ${guidance === undefined ? "omit" : "include"} guidance`,
			[reviewAndChecksRequestRepairs(guidance)],
			function* ({ fleet, prepareWork, finishWorkers, providerStarts, turnOutputById }) {
				yield* prepareWork("one");

				const first = yield* fleet.dispatch("one");
				finishWorkers();
				const reviewRepair = yield* fleet.reconcile("one");
				finishWorkers();
				const checkRepair = yield* fleet.reconcile("one");
				finishWorkers();
				expect((yield* fleet.reconcile("one")).value.step).toBe("done");
				const manual = yield* fleet.continue("one", "Check another case");
				for (const [record, role] of [
					[first, "worker"],
					[reviewRepair, "repair"],
					[checkRepair, "repair"],
					[manual, "repair"],
				] as const) {
					const attempt = record.value.attempts.at(-1);
					expect(attempt?.role).toBe(role);
					expect(turnOutputById(attempt?.receipt?.turnId ?? "missing")).toBe(attempt?.prompt);
					if (guidance === undefined) {
						expect(attempt?.prompt).not.toContain("Repository worker guidance:");
						expect(attempt?.prompt).not.toContain(GUIDANCE);
					} else {
						expect(attempt?.prompt).toContain("Repository worker guidance: maintainer's standing answers");
						expect(attempt?.prompt).toContain(GUIDANCE);
					}
				}
				const reviewers = providerStarts().filter((start) => start.access === "read-only");
				expect(reviewers).not.toEqual([]);
				expect(reviewers.every((start) => !start.prompt.includes(GUIDANCE))).toBe(true);
			},
		);
	}

	engine.it(
		"a capacity retry preserves the guided prompt once across restart",
		[providerCapacityRejected(), workerGuidance(GUIDANCE)],
		function* ({ setFleetTime, recoverProvider, fleet, prepareWork, afterRestart, providerStarts }) {
			yield* prepareWork("one");

			const queued = yield* fleet.dispatch("one");
			expect(queued.value.launchRetry).toBeDefined();
			recoverProvider();
			setFleetTime(30_100);
			yield* afterRestart(cycle);
			const prompt = (yield* fleet.get("one")).value.attempts.at(-1)?.prompt;
			expect(prompt).toBe(queued.value.attempts[0]?.prompt);
			expect(prompt?.split(GUIDANCE)).toHaveLength(2);
			expect(providerStarts().at(-1)?.prompt).toBe(prompt);
		},
	);
});
