import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { steeredTurnActive } from "#test/engineTimingTraits.ts";
import { singleWorkerWithHumanDeliveryConfiguration } from "#test/singleWorkerWithHumanDeliveryConfiguration.ts";

const singleWorkerWithHumanDelivery = engineConfiguration("single worker with human delivery", singleWorkerWithHumanDeliveryConfiguration());
const LAUNCH_RETRY = 30_000;

isolatedEngine.it(
	"a continuation into a hung active turn steers its own thread and keeps the execution capacity",
	[steeredTurnActive(), singleWorkerWithHumanDelivery],
	function* ({ attemptDispatch, continueIntoHungTurn, executionOf, finishWorkers, fleet, prepareWork, steeredSubmissions }) {
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");

		yield* continueIntoHungTurn("one");

		yield* outcomes([
			["one", () => executionOf("one"), "executing"],
			["dispatching two", () => attemptDispatch("two"), "execution capacity of 1 is full"],
		]);
		expect(steeredSubmissions()).toMatchObject([
			{ threadId: "session-operation-1" },
			{ threadId: "session-operation-2" },
			{ threadId: "session-operation-1" },
		]);
	},
);

isolatedEngine.it(
	"Fleet polls a hung turn at once, then at doubling intervals capped at 30 seconds, and stops before five minutes",
	[steeredTurnActive(), singleWorkerWithHumanDelivery],
	function* ({ continueIntoHungTurn, finishWorkers, fleet, outlastHungTurn, prepareWork, steeredPollIntervals }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		yield* continueIntoHungTurn("one");

		yield* outlastHungTurn("one");

		expect(steeredPollIntervals()).toEqual([0, 2000, 4000, 8000, 16_000, ...Array.from({ length: 8 }, () => 30_000)]);
	},
);

isolatedEngine.it(
	"after five minutes a hung turn fails its attempt and waits on automation for a fresh launch from the rejection time",
	[steeredTurnActive(), singleWorkerWithHumanDelivery],
	function* ({ continueIntoHungTurn, currentTime, executionOf, finishWorkers, fleet, outlastHungTurn, prepareWork }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		const rejectedAt = currentTime();
		yield* continueIntoHungTurn("one");

		const blocked = yield* outlastHungTurn("one");

		expect({
			attempts: blocked.attempts.map(
				({ operationId, receipt, status }) => `${operationId} ${status} ${receipt === undefined ? "without receipt" : "with receipt"}`,
			),
			decision: blocked.decision?.code ?? "none",
			execution: yield* executionOf("one"),
			owner: blocked.attentionOwner,
			retryAt: blocked.launchRetry?.retryAt,
			step: blocked.step,
		}).toEqual({
			attempts: ["operation-3 failed without receipt"],
			decision: "none",
			execution: "not executing",
			owner: "automation",
			retryAt: rejectedAt + LAUNCH_RETRY,
			step: "repairing",
		});
	},
);

isolatedEngine.it(
	"a fresh launch queued after a hung turn survives a restart and resumes in a new session at its retry time",
	[steeredTurnActive(), singleWorkerWithHumanDelivery],
	function* ({ advanceTime, completeSteeredTurn, continueIntoHungTurn, finishWorkers, fleet, outlastHungTurn, prepareWork, restart }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		yield* continueIntoHungTurn("one");
		const blocked = yield* outlastHungTurn("one");
		completeSteeredTurn();
		yield* restart();
		expect((yield* fleet.get("one")).value.launchRetry).toEqual(blocked.launchRetry);
		advanceTime(LAUNCH_RETRY);

		const resumed = yield* fleet.reconcile("one");

		expect(resumed.value.step).toBe("working");
		expect(resumed.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(blocked.history?.at(-1)?.attempts[0]?.receipt?.sessionId);
	},
);
