import { Effect } from "effect";
import { expect } from "vitest";
import { bookkeepingBrief, briefAtPhase, noChangeDuringBriefPhase } from "#test/engineBriefFixtures.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { failedValidationUntilRetry } from "#test/failedValidationUntilRetry.ts";

for (const wholeFileRevision of [false, true]) {
	for (const [field, before, after] of [
		["status", "status: draft", "status: deferred"],
		["next_action", "next_action: Implement the work.", "next_action: Work completed."],
	] as const) {
		for (const phase of ["preparation", "execution", "review", "decision"]) {
			const closesDecision = phase === "decision" && field === "status";
			engine.it(
				`${wholeFileRevision ? "saved whole-file" : "authored brief"} ${field} edits during ${phase} ${closesDecision ? "release closed work" : "preserve durable work and its decision"} after restart`,
				[markdownWork(), noChangeDuringBriefPhase(phase), briefAtPhase(phase, bookkeepingBrief, wholeFileRevision)],
				function* ({ boardBrief, boardReceipts, writeBoardWork, answerWorker, launches, finishWorkers, restart, fleet }) {
					const original = bookkeepingBrief(boardBrief());
					const active = yield* fleet.get("one");
					writeBoardWork("one.md", original.replace(before, after));
					yield* restart();
					const unchanged = yield* fleet.reconcile("one");
					if (closesDecision) {
						expect(unchanged.value.step).toBe("released");
						expect(unchanged.value.releaseReason).toBe("Board status is deferred");
						expect(unchanged.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: active.value.decision?.published }]);
						expect(boardReceipts()).toHaveLength(1);
						return;
					}
					expect(unchanged.value).toMatchObject({
						attempts: active.value.attempts,
						boardContext: original,
						boardRevision: active.value.boardRevision,
						step: active.value.step,
					});
					expect(unchanged.value.decision).toEqual(active.value.decision);
					expect(launches()).toHaveLength(active.value.attempts.length);
					if (phase === "decision") {
						const decision = unchanged.value.decision ?? (yield* Effect.die("Missing worker question"));
						const answer = yield* answerWorker(decision);
						yield* restart();
						const continued = yield* fleet.reconcile("one");
						expect(continued.value.step).toBe("working");
						expect(continued.value.attempts.at(-1)?.receipt?.sessionId).toBe(active.value.attempts[0]?.receipt?.sessionId);
						expect(continued.value.responses).toMatchObject([{ boardAcknowledged: true, responseId: answer.id }]);
						expect(boardReceipts()).toHaveLength(1);
						return;
					}
					if (phase === "preparation") {
						const dispatched = yield* fleet.dispatch("one");
						expect(dispatched.value.boardRevision).toBe(active.value.boardRevision);
						if (field === "status") {
							expect(dispatched.value.step).toBe("released");
							expect(launches()).toEqual([]);
							return;
						}
					}
					finishWorkers();
					const completed = yield* fleet.reconcile("one");
					expect(completed.value.step).toBe("done");
					expect(completed.value.decision).toBeUndefined();
				},
			);
		}
	}
}

{
	const options = { checksFailure: true, noChange: true };
	engine.it(
		"bookkeeping edits leave a validation decision resolvable by its original retry answer",
		[markdownWork(), failedValidationUntilRetry({ options: () => options })],
		function* ({ boardBrief, writeBoardWork, answerReport, launches, finishWorkers, prepareWork, restart, fleet }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const decision = (yield* fleet.reconcile("one")).value.decision;
			if (decision?.published === undefined) {
				return yield* Effect.die("Missing validation decision");
			}
			const answer = answerReport(decision.published, "retry");
			writeBoardWork("one.md", boardBrief().replace("kind: task", "kind: task\nstatus: deferred\nnext_action: Work completed."));
			options.checksFailure = false;
			yield* restart();
			const resolved = yield* fleet.resolve("one", decision.id, answer);
			expect(resolved.value.step).toBe("reviewing");
			expect(resolved.value.decision).toBeUndefined();
			expect(resolved.value.responses).toMatchObject([{ action: "retry", boardAcknowledged: true, responseId: answer }]);
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			expect(launches()).toHaveLength(2);
		},
	);
}
