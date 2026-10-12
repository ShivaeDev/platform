import { Effect } from "effect";
import { expect } from "vitest";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepareBookkeepingPhase } from "#test/prepareBookkeepingPhase.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test");

for (const field of ["criteria", "body"]) {
	for (const phase of ["preparation", "execution", "review", "decision"]) {
		test(`${field} edits during ${phase} stop work with Board context changed after restart`, () =>
			withFleetBoard({ noChange: true, reviewRunning: phase === "review" }, (fixture, root, source) =>
				Effect.gen(function* () {
					const files = boardHttpFiles(root);
					const original = source.replace("kind: task", "kind: task\ncriteria: [{ id: behavior, text: Original behavior. }]");
					files.write("one.md", original);
					const active = yield* prepareBookkeepingPhase(fixture, phase);
					if (phase === "decision") {
						const decision = active.value.decision ?? (yield* Effect.die("Missing worker question"));
						yield* answerWorker(root, decision);
					}
					const turns = fixture.settings.filter((call) => call.call === "turn").length;
					const current = field === "criteria" ? original.replace("Original behavior.", "Changed behavior.") : `${original}\nChanged scope.\n`;
					files.write("one.md", current);
					const stopped = yield* fixture.restart(
						Fleet.pipe(Effect.flatMap((restarted) => (phase === "preparation" ? restarted.dispatch("one") : restarted.reconcile("one")))),
					);
					expect(stopped.value.stage).toBe("needs-human");
					expect(stopped.value.blocker ?? stopped.value.decision?.reason).toContain("Board context changed");
					expect(stopped.value.attentionOwner).toBe("maintainer");
					expect(stopped.value.boardContext).toBe(original);
					expect(stopped.value.boardRevision).toBe(active.value.boardRevision);
					expect(stopped.value.attempts).toEqual(active.value.attempts);
					expect(stopped.value.outcome).toBeUndefined();
					expect(stopped.value.responses).toBeUndefined();
					expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(turns);
				}),
			));
	}
}
