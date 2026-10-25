import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { LINKED_GOAL, linkedBrief } from "#test/engineBriefFixtures.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork, reviewerStillRunning } from "#test/engineTraits.ts";
import { QUESTION } from "#test/workerQuestion.ts";

for (const step of ["preparation", "execution", "review"] as const) {
	engine.it(
		`editing a linked goal and unrelated item during ${step} leaves the current brief running`,
		[markdownWork(), reviewerStillRunning()],
		function* ({ boardBrief, writeBoardWork, publishedDecisions, finishWorkers, prepareWork, fleet }) {
			const source = boardBrief();
			writeBoardWork("one.md", linkedBrief(source));
			writeBoardWork("goal.md", LINKED_GOAL);
			writeBoardWork("other.md", "---\nid: other\nkind: plan\n---\n# Unrelated plan\n");
			const prepared = yield* prepareWork("one");
			if (step !== "preparation") {
				yield* fleet.dispatch("one");
			}
			if (step === "review") {
				finishWorkers();
				expect((yield* fleet.reconcile("one")).value.step).toBe("reviewing");
			}
			writeBoardWork("goal.md", `${LINKED_GOAL}| Active | Example |\n`);
			writeBoardWork("other.md", "---\nid: other\nkind: plan\n---\n# Updated plan\n");
			const running = yield* step === "preparation" ? fleet.dispatch("one") : fleet.reconcile("one");
			expect(running.value.step).toBe(step === "review" ? "reviewing" : "working");
			expect(running.value.boardRevision).toBe(prepared.value.boardRevision);
			expect(running.value.boardContext).toBe(linkedBrief(source));
			expect(running.value.decision).toBeUndefined();
			expect(publishedDecisions()).toHaveLength(0);
		},
	);
}

engine.it(
	"an answer recorded immediately before unrelated Board edits reaches the worker after restart",
	[markdownWork()],
	function* ({ boardBrief, writeBoardWork, answerWorker, launches, workerQuestion, prepareWork, restart, fleet }) {
		const source = boardBrief();
		writeBoardWork("one.md", linkedBrief(source));
		writeBoardWork("goal.md", LINKED_GOAL);
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* workerQuestion("one", QUESTION);
		const stopped = yield* fleet.reconcile("one");
		const decision = stopped.value.decision;
		if (decision?.published === undefined) {
			return yield* Effect.die("Missing published worker question");
		}
		const answer = yield* answerWorker(decision);
		writeBoardWork("goal.md", `${LINKED_GOAL}| Queued | Other |\n`);
		writeBoardWork("other.md", "---\nid: other\nkind: report\n---\n# Bookkeeping\n");
		yield* restart();
		const continued = yield* fleet.reconcile("one");
		expect(continued.value.step).toBe("working");
		expect(continued.value.boardContext).toBe(linkedBrief(source));
		expect(continued.value.attempts.at(-1)?.prompt).toBe(answer.body);
		expect(continued.value.responses).toMatchObject([{ boardAcknowledged: true, responseId: answer.id }]);
		expect(launches()).toHaveLength(1);
	},
);

engine.it(
	"two answers from the same author continue the worker with the newest answer",
	[markdownWork()],
	function* ({ answerWorker, providerCalls, workerQuestion, prepareWork, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* workerQuestion("one", QUESTION);
		const stopped = yield* fleet.reconcile("one");
		const decision = stopped.value.decision;
		if (decision?.published === undefined) {
			return yield* Effect.die("Missing published worker question");
		}
		yield* answerWorker(decision, "response.first", "answer", undefined, "orchestrator", "Use SQLite.");
		const newest = yield* answerWorker(decision, "response.second", "answer", undefined, "orchestrator");
		const continued = yield* fleet.reconcile("one");
		expect(continued.value.step).toBe("working");
		expect(continued.value.attempts.at(-1)?.prompt).toBe(newest.body);
		expect(continued.value.responses).toMatchObject([{ boardAcknowledged: true, responseId: newest.id }]);
		expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(2);
	},
);
