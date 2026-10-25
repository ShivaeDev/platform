import { Effect } from "effect";
import { expect } from "vitest";
import { pendingAcknowledgements } from "#engine/pendingAcknowledgements.ts";
import { supersededBoardQuestionsConfiguration, unavailableHistoricalQuestionsConfiguration } from "#test/acknowledgementIsolationTraits.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { engine } from "#test/engineStory.ts";
import { prepared } from "#test/preparation.ts";

const supersededBoardQuestions = engineConfiguration("superseded board questions", supersededBoardQuestionsConfiguration());

const unavailableHistoricalQuestions = engineConfiguration("unavailable historical questions", unavailableHistoricalQuestionsConfiguration());

engine.it(
	"unqualifiable replaced and archived decision acknowledgements close durably as superseded",
	[supersededBoardQuestions],
	function* ({ acknowledgementAttempts, acknowledgements, approveWork, editWork, finishWorkers, prepareWork, restart, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const decision = (yield* fleet.reconcile("one")).value.decision ?? (yield* Effect.die("Missing delivery decision"));
		const reassigned = yield* fleet.reassign("one", decision.id, "maintainer");
		expect(reassigned.value.supersededDecisions).toMatchObject([{ boardAcknowledgementDisposition: "superseded", published: decision.published }]);
		editWork("one", "board-one-renewed");
		approveWork("one", "board-one-renewed");
		const renewed = yield* prepareWork("one");
		expect(renewed.value.history?.[0]?.decision).toMatchObject({ boardAcknowledgementDisposition: "superseded", id: reassigned.value.decision?.id });
		expect(renewed.value.blocker).toBeUndefined();
		expect(pendingAcknowledgements(renewed.value)).toEqual([]);
		const attempts = acknowledgementAttempts().length;
		yield* restart();
		const restarted = yield* fleet.reconcile("one");
		expect(restarted.version).toBe(renewed.version);
		expect(acknowledgementAttempts()).toHaveLength(attempts);
		expect(acknowledgements()).toHaveLength(0);
	},
);

engine.it(
	"permanently failed historical superseded acknowledgement never blocks current applied acknowledgement",
	[unavailableHistoricalQuestions],
	function* ({ acknowledgements, launches, approveWork, editWork, finishWorkers, prepareWork, respond, restart, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const previous = (yield* fleet.reconcile("one")).value.decision ?? (yield* Effect.die("Missing delivery decision"));
		editWork("one", "board-one-renewed");
		approveWork("one", "board-one-renewed");
		yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src/renewed.ts"] }), prompt: "Renewed work", workId: "one" });
		const pending = yield* fleet.dispatch("one");
		const currentId = pending.value.decision?.id ?? "missing";
		expect(currentId).not.toBe(previous.id);
		const responseId = respond(currentId, "release");
		const applied = yield* fleet.resolve("one", currentId, responseId);
		expect(applied.value.step).toBe("released");
		expect(applied.value.responses?.[0]?.boardAcknowledged).toBe(true);
		expect(applied.value.history?.[0]?.decisionAcknowledged).toBeUndefined();
		expect(applied.value.blocker).toContain(previous.published?.questionId);
		expect(applied.value.blocker).toContain("Historical question unavailable");
		expect(acknowledgements()).toHaveLength(1);
		expect(acknowledgements()[0]).toMatchObject({ disposition: "applied", responseId });
		yield* restart();
		const repeated = yield* fleet.resolve("one", currentId, responseId);
		expect(repeated.value.responses).toHaveLength(1);
		expect(repeated.value.responses?.[0]?.boardAcknowledged).toBe(true);
		expect(repeated.value.history?.[0]?.decisionAcknowledged).toBeUndefined();
		expect(acknowledgements()).toHaveLength(1);
		expect(launches()).toHaveLength(2);
	},
);
