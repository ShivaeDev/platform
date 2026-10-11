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
		test(`${field} edits during ${phase} still stop changed work after restart`, () =>
			withFleetBoard({ noChange: true, reviewRunning: phase === "review" }, (fixture, root, source) =>
				Effect.gen(function* () {
					const files = boardHttpFiles(root);
					const original = source.replace("kind: task", "kind: task\ncriteria: [{ id: behavior, text: Original behavior. }]");
					files.write("one.md", original);
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* fleet.dispatch("one");
					if (phase === "review") {
						finishWorkers(fixture);
						expect((yield* fleet.reconcile("one")).value.stage).toBe("reviewing");
					} else if (phase === "decision") {
						const { decision } = yield* askWorker(fixture);
						yield* answerWorker(root, decision);
					}
					files.write("one.md", field === "criteria" ? original.replace("Original behavior.", "Changed behavior.") : `${original}\nChanged scope.\n`);
					finishWorkers(fixture);
					const stopped = yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("one"))));
					expect(stopped.value.stage).toBe("needs-human");
					expect(stopped.value.blocker ?? stopped.value.decision?.reason).toContain("Board context changed");
					expect(stopped.value.outcome).toBeUndefined();
					expect(fixture.launched).toHaveLength(phase === "review" ? 2 : 1);
				}),
			));
	}
}
