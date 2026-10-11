import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

for (const field of ["criteria", "body"]) {
	for (const phase of ["execution", "review", "decision"]) {
		test(`${field} edits during ${phase} continue the same worker with its refreshed brief after restart`, () =>
			withFleetBoard({ noChange: true, reviewRunning: phase === "review" }, (fixture, root, source) =>
				Effect.gen(function* () {
					const files = boardHttpFiles(root);
					const original = source.replace("kind: task", "kind: task\ncriteria: [{ id: behavior, text: Original behavior. }]");
					files.write("one.md", original);
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					const dispatched = yield* fleet.dispatch("one");
					if (phase === "review") {
						finishWorkers(fixture);
						expect((yield* fleet.reconcile("one")).value.stage).toBe("reviewing");
					} else if (phase === "decision") {
						const { decision } = yield* askWorker(fixture);
						yield* answerWorker(root, decision);
					}
					const current = field === "criteria" ? original.replace("Original behavior.", "Changed behavior.") : `${original}\nChanged scope.\n`;
					files.write("one.md", current);
					finishWorkers(fixture);
					const continued = yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("one"))));
					expect(continued.value.stage).toBe("executing");
					expect(continued.value.boardContext).toBe(current);
					expect(continued.value.decision).toBeUndefined();
					expect(continued.value.outcome).toBeUndefined();
					expect(continued.value.review).toBeUndefined();
					expect(continued.value.checks).toBeUndefined();
					expect(continued.value.attempts.at(-1)?.receipt?.sessionId).toBe(dispatched.value.attempts[0]?.receipt?.sessionId);
					expect(continued.value.attempts.at(-1)?.prompt).toContain(current);
					expect(continued.value.attempts.at(-1)?.prompt).toContain("Previous brief:");
					expect(fixture.launched).toHaveLength(phase === "review" ? 2 : 1);
					finishWorkers(fixture);
					yield* fleet.reconcile("one");
					finishWorkers(fixture);
					expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
				}),
			));
	}
}
