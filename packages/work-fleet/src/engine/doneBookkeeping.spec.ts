import { Effect } from "effect";
import { expect } from "vitest";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork, noChangeReported, reviewerStillRunning } from "#test/engineTraits.ts";
import { QUESTION } from "#test/workerQuestion.ts";

for (const wholeFileRevision of [false, true]) {
	for (const phase of ["preparation", "execution", "review", "decision", "completed"]) {
		engine.it(
			`${wholeFileRevision ? "saved whole-file" : "authored brief"} ${phase} work survives status done and ${["preparation", "decision"].includes(phase) ? "releases without launching" : "completes normally"}`,
			[noChangeReported(phase !== "review"), reviewerStillRunning(phase === "review"), markdownWork()],
			function* ({
				fleet,
				prepareWork,
				finishWorkers,
				restart,
				turnReports,
				boardBrief,
				writeBoardWork,
				replaceStoredRecord,
				providerCalls,
				boardReceipts,
				foreignReservations,
			}) {
				const original = boardBrief().replace("kind: task", "kind: task\nstatus: planned\nnext_action: Implement the work.");
				writeBoardWork("one.md", original);
				yield* prepareWork("one");
				if (wholeFileRevision) {
					const prepared = (yield* fleet.get("one")).value;
					const context = prepared.boardContext ?? (yield* Effect.die("Missing saved Board source"));
					yield* replaceStoredRecord({ ...prepared, boardRevision: revisionOf(context) });
				}
				if (phase !== "preparation") {
					yield* fleet.dispatch("one");
					yield* fleet.reconcile("one");
				}
				if (["review", "completed"].includes(phase)) {
					finishWorkers();
					yield* fleet.reconcile("one");
				} else if (phase === "decision") {
					yield* turnReports(yield* fleet.get("one"), `FLEET_QUESTION: ${QUESTION}`);
					expect((yield* fleet.reconcile("one")).value.decision?.published).toBeDefined();
				}
				const active = yield* fleet.get("one");
				const turns = providerCalls().filter((call) => call.call === "turn").length;
				writeBoardWork("one.md", original.replace("status: planned", "status: done").replace("Implement the work.", "Work completed."));
				yield* restart();
				const preserved = yield* fleet.reconcile("one");
				if (phase === "decision") {
					expect(preserved.value.stage).toBe("released");
					expect(preserved.value.releaseReason).toBe("Board status is done");
					expect(preserved.value.decision).toBeUndefined();
					expect(preserved.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: active.value.decision?.published }]);
					expect(boardReceipts()).toHaveLength(1);
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
				expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(turns);
				if (phase === "preparation") {
					expect((yield* fleet.dispatch("one")).value.stage).toBe("released");
					expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(turns);
					return;
				}
				finishWorkers();
				const completed = yield* fleet.reconcile("one");
				expect(completed.value.stage).toBe("completed");
				expect(completed.value.decision).toBeUndefined();
				expect(completed.value.boardContext).toBe(original);
				expect(yield* foreignReservations()).toEqual([]);
			},
		);
	}
}
