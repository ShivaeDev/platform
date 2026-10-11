import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles, boardOverview } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { prepareBookkeepingPhase } from "#test/prepareBookkeepingPhase.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker } from "#test/workerQuestion.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

for (const [phase, observedStage, terminalStage, foreignOwners] of [
	["preparation", "released", "released", []],
	["execution", "executing", "released", []],
	["review", "reviewing", "released", ["https://example.invalid/pr/one"]],
	["decision", "released", "released", []],
	["completed", "completed", "completed", []],
] as const) {
	test(`marking ${phase} work done settles cleanly without another turn or needs-human decision`, () =>
		withFleetBoard({ noChange: phase !== "review", reviewRunning: phase === "review" }, (fixture, root, source) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				const active = yield* prepareBookkeepingPhase(fixture, phase);
				const turns = fixture.settings.filter((call) => call.call === "turn").length;
				boardHttpFiles(root).write("one.md", source.replace("kind: task", "kind: task\nstatus: done\nnext_action: Work completed."));
				const observed = yield* phase === "preparation" ? fleet.dispatch("one") : fleet.reconcile("one");
				expect(observed.value.stage).toBe(observedStage);
				expect(observed.value.boardRevision).toBe(active.value.boardRevision);
				finishWorkers(fixture);
				const settled = yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("one"))));
				expect(settled.value.stage).toBe(terminalStage);
				expect(settled.value.decision).toBeUndefined();
				expect(settled.value.blocker).toBeUndefined();
				expect(settled.value.outcome).toEqual(active.value.outcome);
				expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(turns);
				expect(yield* boardOverview(root)).not.toContain("data-attention-item=");
				expect((yield* fixture.foreignReservations()).map(({ owner }) => owner)).toEqual(foreignOwners);
			}),
		));
}

test("done work retains uncertain provider ownership and retries observation without asking a human", () =>
	withFleetBoard({}, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			const active = yield* fleet.dispatch("one");
			const receipt = active.value.attempts[0]?.receipt ?? (yield* Effect.die("Missing receipt"));
			fixture.failedObservations.add(receipt.turnId);
			boardHttpFiles(root).write("one.md", source.replace("kind: task", "kind: task\nstatus: done"));
			const uncertain = yield* fleet.reconcile("one");
			expect(uncertain.value.stage).toBe("executing");
			expect(uncertain.value.blocker).toContain("Observation temporarily unavailable");
			expect(uncertain.value.decision).toBeUndefined();
			finishWorkers(fixture);
			expect((yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("one"))))).value.stage).toBe("released");
			expect(fixture.launched).toHaveLength(1);
		}),
	));

test("an answered worker decision on done work closes without continuing its worker", () =>
	withFleetBoard({}, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			const active = yield* prepareBookkeepingPhase(fixture, "decision");
			const decision = active.value.decision ?? (yield* Effect.die("Missing question"));
			const answer = yield* answerWorker(root, decision);
			boardHttpFiles(root).write("one.md", source.replace("kind: task", "kind: task\nstatus: done"));
			const released = yield* fleet.resolve("one", decision.id, answer.id);
			expect(released.value.stage).toBe("released");
			expect(released.value.decision).toBeUndefined();
			expect(released.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: decision.published }]);
			expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(1);
			expect(yield* boardOverview(root)).not.toContain("data-attention-item=");
		}),
	));
