import { expect } from "@effect/vitest";
import { cycle } from "#engine/scheduler.ts";
import { answerQueueCanFill } from "#test/engineProviderRetryTraits.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";

engine.it(
	"a queue-full answer retries the exact response as a worker turn on its existing thread",
	[markdownWork(), answerQueueCanFill()],
	function* ({ setFleetTime, rejectProvider, recoverProvider, fleet, prepareWork, afterRestart, launches, providerCalls, askWorker, answerWorker }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const { decision } = yield* askWorker();
		const answer = yield* answerWorker(decision);
		rejectProvider();
		const queued = (yield* fleet.resolve("one", decision.id, answer.id)).value;
		expect(queued.step).toBe("repairing");
		expect(queued.responses).toHaveLength(1);
		recoverProvider();
		setFleetTime(30_099);
		yield* afterRestart(cycle);
		expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(2);
		setFleetTime(30_100);
		yield* afterRestart(cycle);
		const accepted = (yield* fleet.get("one")).value;
		expect(accepted.attempts.at(-1)).toMatchObject({ prompt: answer.body, receipt: { sessionId: decision.worker?.sessionId }, role: "worker" });
		expect(accepted.responses).toHaveLength(1);
		expect(accepted.history ?? []).toEqual([]);
		expect(launches()).toHaveLength(1);
		expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(3);
	},
);

engine.it(
	"a queued answer continues on its existing thread after an approved brief edit",
	[markdownWork(), answerQueueCanFill()],
	function* ({
		setFleetTime,
		changeHostModel,
		rejectProvider,
		recoverProvider,
		fleet,
		prepareWork,
		afterRestart,
		launches,
		providerCalls,
		source,
		askWorker,
		answerWorker,
		writeBoardWork,
	}) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const { decision } = yield* askWorker();
		const answer = yield* answerWorker(decision);
		rejectProvider();
		const queued = (yield* fleet.resolve("one", decision.id, answer.id)).value;
		expect(queued.responses).toMatchObject([{ boardAcknowledged: true, responseId: answer.id }]);
		const failed = queued.attempts.at(-1);
		expect(failed).toMatchObject({ prompt: answer.body, role: "worker", settings: { model: "initial-model" }, status: "failed" });
		const current = `${source}\nNew approved criteria.\n`;
		writeBoardWork("one.md", current);
		changeHostModel("new-host-model");
		recoverProvider();
		setFleetTime(30_099);
		yield* afterRestart(cycle);
		expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(2);
		expect((yield* fleet.get("one")).value.decision).toBeUndefined();
		setFleetTime(30_100);
		yield* afterRestart(cycle);
		const accepted = (yield* fleet.get("one")).value;
		const attempt = accepted.attempts.at(-1);
		expect(accepted.step).toBe("working");
		expect(accepted.decision).toBeUndefined();
		expect(accepted.boardContext).toBe(current);
		expect(accepted.launchRetry).toBeUndefined();
		expect(attempt).toMatchObject({ receipt: { sessionId: decision.worker?.sessionId }, role: "worker", settings: failed?.settings });
		expect(accepted.attempts.slice(0, -1)).toEqual(queued.attempts);
		expect(accepted.responses).toEqual(queued.responses);
		expect(accepted.history ?? []).toEqual([]);
		expect(launches()).toHaveLength(1);
		expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(3);
	},
);
