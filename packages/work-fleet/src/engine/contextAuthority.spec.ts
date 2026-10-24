import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { QUESTION } from "#test/workerQuestion.ts";

engine.it(
	"unapproved work retains an open answer without launching another turn",
	[markdownWork()],
	function* ({ boardBrief, writeBoardWork, answerWorker, providerCalls, workerQuestion, prepareWork, fleet }) {
		const source = boardBrief();
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* workerQuestion("one", QUESTION);
		const stopped = yield* fleet.reconcile("one");
		const decision = stopped.value.decision;
		if (decision?.published === undefined) {
			return yield* Effect.die("Missing published worker question");
		}
		const answer = yield* answerWorker(decision);
		const current = source.replace("fleet: approved", "fleet: held");
		writeBoardWork("one.md", current);
		const held = yield* fleet.reconcile("one");
		expect(held.value.step).toBe("waiting");
		expect(held.value.blocker).toContain("no longer approved");
		expect(held.value.responses).toBeUndefined();
		expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(1);
		writeBoardWork("one.md", source);
		const continued = yield* fleet.reconcile("one");
		expect(continued.value.step).toBe("working");
		expect(continued.value.attempts.at(-1)?.prompt).toContain(answer.body);
	},
);
