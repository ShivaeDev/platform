import { expect } from "vitest";
import { continuedWorkHasExpiredAreas } from "#test/engineAreaTraits.ts";
import { engine } from "#test/engineStory.ts";
import { noChangeReported } from "#test/engineTraits.ts";

const FOLLOW_UP = "Check the follow-up";
const HELD_BY_TWO = "admission refused: waiting for area fleet/host held by two";

engine.it(
	"continuing done work while another task holds its area is refused, launches nothing and leaves it done",
	[noChangeReported()],
	function* ({ attemptContinue, finishWorkers, fleet, prepareWork, providerOperations, setAreas, stepOf }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		yield* fleet.dispatch("two");
		const operations = providerOperations();

		const refused = yield* attemptContinue("one", FOLLOW_UP);

		expect({ one: yield* stepOf("one"), operations: providerOperations(), refused }).toEqual({ one: "done", operations, refused: HELD_BY_TWO });
	},
);

engine.it(
	"continuing done work once its area is free resumes its session with the old attempts in history",
	[noChangeReported()],
	function* ({ attemptContinue, finishWorkers, fleet, prepareWork, setAreas }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		yield* fleet.dispatch("two");
		expect(yield* attemptContinue("one", FOLLOW_UP)).toBe(HELD_BY_TWO);
		finishWorkers();
		yield* fleet.reconcile("two");

		const continued = yield* fleet.continue("one", FOLLOW_UP);

		expect({
			attempts: continued.value.attempts.map(({ operationId, receipt }) => `${operationId} in ${receipt?.sessionId}`),
			history: continued.value.history?.[0]?.attempts.map(({ operationId }) => operationId),
			step: continued.value.step,
		}).toEqual({ attempts: ["operation-6 in session-operation-1"], history: ["operation-1", "operation-2"], step: "working" });
	},
);

engine.it(
	"continuing a PR after its merge wait reacquires its area and moves the merge timer into history",
	[continuedWorkHasExpiredAreas()],
	function* ({ advanceTime, answerDecision, attemptContinue, currentTime, finishWorkers, fleet, prepareWork, setAreas }) {
		setAreas("one", ["fleet/host"]);
		setAreas("two", ["fleet/host"]);
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		const readyAt = currentTime();
		expect((yield* fleet.reconcile("one")).value.mergeReadyAt).toBe(readyAt);
		advanceTime(5000);
		yield* fleet.dispatch("two");
		expect(yield* attemptContinue("one", "Revise the PR")).toBe(HELD_BY_TWO);
		finishWorkers();
		yield* fleet.reconcile("two");
		yield* answerDecision("two", "release");

		const continued = yield* fleet.continue("one", "Revise the PR");

		expect({
			areasReleased: continued.value.mergeAreasReleased ?? "not released",
			history: continued.value.history?.[0]?.mergeReadyAt,
			mergeReadyAt: continued.value.mergeReadyAt ?? "no merge wait",
			step: continued.value.step,
		}).toEqual({ areasReleased: "not released", history: readyAt, mergeReadyAt: "no merge wait", step: "working" });
	},
);
