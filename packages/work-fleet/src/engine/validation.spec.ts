import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { engine } from "#test/engineStory.ts";
import { ADOPTED_HEAD, checkRun, NEW_HEAD } from "#test/githubChecks.ts";
import { checksAreQueued, checksAreRunning, newPushIsGreen, requiredCheckKeepsFailing } from "#test/validationScenarios.ts";

{
	const setup = requiredCheckKeepsFailing();
	engine.it(
		"publishes an orchestrator decision after three repairs leave the same required check failing, including after restart",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers, restart }) {
			const context = setup.context();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			for (let repair = 0; repair < 3; repair += 1) {
				finishWorkers();
				const repairing = yield* fleet.reconcile("one");
				expect(repairing.value.stage).toBe("executing");
				expect(repairing.value.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(repair + 1);
				context.head = String(repair + 1).repeat(40);
				context.github.reply(context.head, [[checkRun({ conclusion: "failure", headSha: context.head, name: "verify" })]]);
			}
			finishWorkers();
			const stopped = yield* restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
			expect(stopped.value.stage).toBe("needs-human");
			expect(stopped.value.decision).toMatchObject({ attentionOwner: "orchestrator", reason: expect.stringContaining("verify") });
			expect(stopped.value.decisionPublished).toBe(true);
			expect(fixture.decisions).toHaveLength(1);
			expect(stopped.value.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(3);
			const launched = fixture.launched.length;
			yield* fleet.reconcile("one");
			expect(fixture.launched).toHaveLength(launched);
			expect(fixture.merged).toHaveLength(0);
		},
	);
}

{
	const setup = checksAreQueued();
	engine.it(
		"pending checks survive restart in validation, then deliver when the adopted SHA turns green",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers, restart }) {
			const context = setup.context();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const pending = yield* fleet.reconcile("one");
			expect(pending.value.stage).toBe("validating");
			expect(pending.value.checks).toMatchObject({ head: ADOPTED_HEAD, pending: true });
			expect((yield* restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))))).value.stage).toBe("validating");
			expect(fixture.decisions).toHaveLength(0);
			expect(fixture.merged).toHaveLength(0);
			expect(fixture.launched).toHaveLength(2);
			context.github.reply(ADOPTED_HEAD, [[checkRun()]]);
			const completed = yield* fleet.reconcile("one");
			expect(completed.value.stage).toBe("completed");
			expect(completed.value.checks).toMatchObject({ head: ADOPTED_HEAD, passed: true, pending: false });
			expect(fixture.merged).toEqual([ADOPTED_HEAD]);
			expect(fixture.reviews).toHaveLength(1);
		},
	);
}

{
	const setup = checksAreRunning();
	engine.it(
		"pending checks that fail send names and logs to repair and revalidate its new head",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers }) {
			const context = setup.context();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.stage).toBe("validating");
			context.github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "build" })]]);
			const repair = yield* fleet.reconcile("one");
			expect(repair.value.stage).toBe("executing");
			const attempt = repair.value.attempts.at(-1);
			expect(attempt?.role).toBe("repair");
			const prompt = fixture.observations.get(attempt?.receipt?.turnId ?? "missing")?.output;
			expect(prompt).toContain("build: https://example.invalid/logs/test");
			expect(prompt).toContain(ADOPTED_HEAD);
			expect(fixture.merged).toHaveLength(0);
			expect(fixture.decisions).toHaveLength(0);
			context.head = NEW_HEAD;
			context.github.reply(NEW_HEAD, [[checkRun({ headSha: NEW_HEAD })]]);
			finishWorkers();
			const completed = yield* fleet.reconcile("one");
			expect(completed.value.stage).toBe("completed");
			expect(completed.value.checks?.head).toBe(NEW_HEAD);
			expect(fixture.reviews).toEqual([ADOPTED_HEAD, NEW_HEAD]);
		},
	);
}

{
	const setup = newPushIsGreen();
	engine.it(
		"a newer green push leaves the adopted pending head in validation",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, finishWorkers }) {
			const context = setup.context();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.stage).toBe("validating");
			expect((yield* fleet.reconcile("one")).value.checks?.head).toBe(ADOPTED_HEAD);
			expect(fixture.merged).toHaveLength(0);
			expect(context.github.requests.filter((request) => request.includes("/commits/")).every((request) => request.includes(ADOPTED_HEAD))).toBe(
				true,
			);
		},
	);
}
