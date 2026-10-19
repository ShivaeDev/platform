import { Effect } from "effect";
import { expect } from "vitest";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
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
		test(`${field} edits during ${phase} refresh active work and approve pending worker answers after restart`, () =>
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
					expect(stopped.value.stage).toBe("executing");
					expect(stopped.value.boardContext).toBe(current);
					expect(stopped.value.boardRevision).toBe(briefRevision(metadataParse(current)));
					expect(stopped.value.decision).toBeUndefined();
					expect(stopped.value.attempts.at(-1)?.prompt).toContain(current);
					expect(stopped.value.responses).toMatchObject([{ action: "continue", boardAcknowledged: true }]);
					expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(turns + 1);
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
