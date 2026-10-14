import { Effect } from "effect";
import { expect } from "vitest";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { finishWorkers } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepareBookkeepingPhase } from "#test/prepareBookkeepingPhase.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = postgresTests("test");

for (const wholeFileRevision of [false, true]) {
	for (const phase of ["preparation", "execution", "review", "decision", "completed"]) {
		test(`${wholeFileRevision ? "saved whole-file" : "authored brief"} ${phase} work survives status done and ${["preparation", "decision"].includes(phase) ? "releases without launching" : "completes normally"}`, () =>
			withFleetBoard({ noChange: phase !== "review", reviewRunning: phase === "review" }, (fixture, root, source) =>
				Effect.gen(function* () {
					const files = boardHttpFiles(root);
					const original = source.replace("kind: task", "kind: task\nstatus: planned\nnext_action: Implement the work.");
					files.write("one.md", original);
					const fleet = yield* Fleet;
					const active = yield* prepareBookkeepingPhase(fixture, phase, wholeFileRevision);
					const turns = fixture.settings.filter((call) => call.call === "turn").length;
					files.write("one.md", original.replace("status: planned", "status: done").replace("Implement the work.", "Work completed."));
					const preserved = yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("one"))));
					if (phase === "decision") {
						expect(preserved.value.stage).toBe("released");
						expect(preserved.value.releaseReason).toBe("Board status is done");
						expect(preserved.value.decision).toBeUndefined();
						expect(preserved.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: active.value.decision?.published }]);
						expect(files.receipts()).toHaveLength(1);
						return;
					}
					expect(preserved.value).toMatchObject({
						attempts: active.value.attempts,
						boardContext: original,
						boardRevision: active.value.boardRevision,
						stage: active.value.stage,
					});
					expect(preserved.value.decision).toEqual(active.value.decision);
					expect(preserved.value.result).toEqual(active.value.result);
					expect(preserved.value.outcome).toEqual(active.value.outcome);
					expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(turns);
					if (phase === "preparation") {
						expect((yield* fleet.dispatch("one")).value.stage).toBe("released");
						expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(turns);
						return;
					}
					finishWorkers(fixture);
					const completed = yield* fleet.reconcile("one");
					expect(completed.value.stage).toBe("completed");
					expect(completed.value.decision).toBeUndefined();
					expect(completed.value.boardContext).toBe(original);
					expect(yield* fixture.foreignReservations()).toEqual([]);
				}),
			));
	}
}
