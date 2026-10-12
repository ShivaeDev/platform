import { Effect } from "effect";
import { expect } from "vitest";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepareBookkeepingPhase } from "#test/prepareBookkeepingPhase.ts";
import { answerReport } from "#test/report.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test");

for (const wholeFileRevision of [false, true]) {
	for (const [field, before, after] of [
		["status", "status: planned", "status: deferred"],
		["superseded status", "status: planned", "status: superseded"],
		["next_action", "next_action: Implement the work.", "next_action: Work completed."],
		["owner", "owner: first-owner", "owner: next-owner"],
	] as const) {
		registerBookkeepingTests(wholeFileRevision, field, before, after);
	}
}

function registerBookkeepingTests(wholeFileRevision: boolean, field: string, before: string, after: string) {
	for (const phase of ["preparation", "execution", "review", "decision"]) {
		test(`${wholeFileRevision ? "saved whole-file" : "authored brief"} ${field} edits during ${phase} preserve durable work and its decision after restart`, () =>
			withFleetBoard({ noChange: true, reviewRunning: phase === "review" }, (fixture, root, source) =>
				Effect.gen(function* () {
					const files = boardHttpFiles(root);
					const original = source.replace("kind: task", "kind: task\nstatus: planned\nnext_action: Implement the work.\nowner: first-owner");
					files.write("one.md", original);
					const fleet = yield* Fleet;
					const active = yield* prepareBookkeepingPhase(fixture, phase, wholeFileRevision);
					const changed = original.replace(before, after);
					files.write("one.md", changed);
					const unchanged = yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("one"))));
					expect(unchanged.value).toMatchObject({
						attempts: active.value.attempts,
						boardContext: original,
						boardRevision: active.value.boardRevision,
						stage: active.value.stage,
					});
					expect(unchanged.value.decision).toEqual(active.value.decision);
					expect(fixture.launched).toHaveLength(active.value.attempts.length);
					if (phase === "decision") {
						const decision = unchanged.value.decision ?? (yield* Effect.die("Missing worker question"));
						const answer = yield* answerWorker(root, decision);
						const continued = yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("one"))));
						expect(continued.value.stage).toBe("executing");
						expect(continued.value.attempts.at(-1)?.receipt?.sessionId).toBe(active.value.attempts[0]?.receipt?.sessionId);
						expect(continued.value.responses).toMatchObject([{ boardAcknowledged: true, responseId: answer.id }]);
						expect(files.receipts()).toHaveLength(1);
					} else {
						if (phase === "preparation") {
							expect((yield* fleet.dispatch("one")).value.boardRevision).toBe(active.value.boardRevision);
						}
						finishWorkers(fixture);
						const completed = yield* fleet.reconcile("one");
						expect(completed.value.stage).toBe("completed");
						expect(completed.value.decision).toBeUndefined();
					}
				}),
			));
	}
}

test("bookkeeping edits leave a validation decision resolvable by its original retry answer", () => {
	const options = { checksFailure: true, noChange: true };
	return withFleetBoard(options, (fixture, root, source) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const decision = (yield* fleet.reconcile("one")).value.decision;
			if (decision?.published === undefined) {
				return yield* Effect.die("Missing validation decision");
			}
			const answer = answerReport(root, decision.published, "retry");
			boardHttpFiles(root).write("one.md", source.replace("kind: task", "kind: task\nstatus: deferred\nnext_action: Work completed."));
			options.checksFailure = false;
			const resolved = yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.resolve("one", decision.id, answer))));
			expect(resolved.value.stage).toBe("reviewing");
			expect(resolved.value.decision).toBeUndefined();
			expect(resolved.value.responses).toMatchObject([{ action: "retry", boardAcknowledged: true, responseId: answer }]);
			expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
			expect(fixture.launched).toHaveLength(2);
		}),
	);
});
