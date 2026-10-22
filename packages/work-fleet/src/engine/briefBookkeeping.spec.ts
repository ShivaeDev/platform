import { Effect } from "effect";
import { expect } from "vitest";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { type EngineFixture, finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepareBookkeepingPhase } from "#test/prepareBookkeepingPhase.ts";
import { answerReport } from "#test/report.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test");

for (const wholeFileRevision of [false, true]) {
	for (const [field, before, after] of [
		["status", "status: draft", "status: deferred"],
		["next_action", "next_action: Implement the work.", "next_action: Work completed."],
	] as const) {
		registerBookkeepingTests(wholeFileRevision, field, before, after);
	}
}

function registerBookkeepingTests(wholeFileRevision: boolean, field: string, before: string, after: string) {
	for (const phase of ["preparation", "execution", "review", "decision"]) {
		const closesDecision = phase === "decision" && field === "status";
		test(`${wholeFileRevision ? "saved whole-file" : "authored brief"} ${field} edits during ${phase} ${closesDecision ? "release closed work" : "preserve durable work and its decision"} after restart`, () =>
			withFleetBoard({ noChange: true, reviewRunning: phase === "review" }, (fixture, root, source) =>
				Effect.gen(function* () {
					const files = boardHttpFiles(root);
					const original = source.replace("kind: task", "kind: task\nstatus: draft\nnext_action: Implement the work.\nowner: codex");
					files.write("one.md", original);
					const active = yield* prepareBookkeepingPhase(fixture, phase, wholeFileRevision);
					const changed = original.replace(before, after);
					files.write("one.md", changed);
					const unchanged = yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("one"))));
					if (closesDecision) {
						assertReleasedBookkeeping(unchanged.value, active.value);
						expect(files.receipts()).toHaveLength(1);
						return;
					}
					expect(unchanged.value).toMatchObject({
						attempts: active.value.attempts,
						boardContext: original,
						boardRevision: active.value.boardRevision,
						step: active.value.step,
					});
					expect(unchanged.value.decision).toEqual(active.value.decision);
					expect(fixture.launched).toHaveLength(active.value.attempts.length);
					if (phase === "decision") {
						yield* continueBookkeepingDecision(fixture, root, unchanged.value, active.value);
					} else {
						yield* finishBookkeepingPhase(fixture, phase, field, active.value.boardRevision);
					}
				}),
			));
	}
}

const finishBookkeepingPhase = Effect.fn("Fleet.finishBookkeepingPhase")(function* (
	fixture: EngineFixture<unknown>,
	phase: string,
	field: string,
	boardRevision: string,
) {
	const fleet = yield* Fleet;
	if (phase === "preparation") {
		const dispatched = yield* fleet.dispatch("one");
		expect(dispatched.value.boardRevision).toBe(boardRevision);
		if (field === "status") {
			expect(dispatched.value.step).toBe("released");
			expect(fixture.launched).toEqual([]);
			return;
		}
	}
	finishWorkers(fixture);
	const completed = yield* fleet.reconcile("one");
	expect(completed.value.step).toBe("done");
	expect(completed.value.decision).toBeUndefined();
});

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
			expect(resolved.value.step).toBe("reviewing");
			expect(resolved.value.decision).toBeUndefined();
			expect(resolved.value.responses).toMatchObject([{ action: "retry", boardAcknowledged: true, responseId: answer }]);
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			expect(fixture.launched).toHaveLength(2);
		}),
	);
});

const continueBookkeepingDecision = Effect.fnUntraced(function* (
	fixture: EngineFixture<unknown>,
	root: string,
	unchanged: FleetRecord,
	active: FleetRecord,
) {
	const decision = unchanged.decision ?? (yield* Effect.die("Missing worker question"));
	const answer = yield* answerWorker(root, decision);
	const continued = yield* fixture.restart(Fleet.pipe(Effect.flatMap((restarted) => restarted.reconcile("one"))));
	expect(continued.value.step).toBe("working");
	expect(continued.value.attempts.at(-1)?.receipt?.sessionId).toBe(active.attempts[0]?.receipt?.sessionId);
	expect(continued.value.responses).toMatchObject([{ boardAcknowledged: true, responseId: answer.id }]);
	expect(boardHttpFiles(root).receipts()).toHaveLength(1);
});

function assertReleasedBookkeeping(current: FleetRecord, active: FleetRecord) {
	expect(current.step).toBe("released");
	expect(current.releaseReason).toBe("Board status is deferred");
	expect(current.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: active.decision?.published }]);
}
