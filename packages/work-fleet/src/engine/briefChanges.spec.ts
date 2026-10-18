import { Effect } from "effect";
import { expect } from "vitest";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepareBookkeepingPhase } from "#test/prepareBookkeepingPhase.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test");

for (const field of ["criteria", "body"]) {
	for (const phase of ["preparation", "execution", "review", "decision"]) {
		test(`${field} edits during ${phase} refresh active work and guard pending answers after restart`, () =>
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
					if (phase !== "decision") {
						assertRefreshedBrief(stopped.value, active.value, current, phase);
						expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(turns + (phase === "preparation" ? 1 : 0));
						return;
					}
					expect(stopped.value.stage).toBe("needs-human");
					expect(stopped.value.blocker ?? stopped.value.decision?.reason).toContain("Board context changed");
					expect(stopped.value.attentionOwner).toBe("orchestrator");
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

function assertRefreshedBrief(current: FleetRecord, previous: FleetRecord, source: string, phase: string) {
	expect(current.stage).toBe(phase === "review" ? "reviewing" : "executing");
	expect(current.boardContext).toBe(source);
	expect(current.boardRevision).toBe(briefRevision(metadataParse(source)));
	expect(current.decision).toBeUndefined();
	if (phase === "preparation") {
		expect(current.attempts[0]?.receipt).toBeDefined();
	} else {
		expect(current.attempts[0]?.receipt).toEqual(previous.attempts[0]?.receipt);
	}
}
