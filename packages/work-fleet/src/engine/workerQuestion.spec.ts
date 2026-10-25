import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { decisionPublicationFailsOnce } from "#test/engineLaunchTraits.ts";
import { workerAnswerAcknowledgementLost } from "#test/engineLifecycleTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { QUESTION } from "#test/workerQuestion.ts";

isolatedEngine.it(
	"concurrent answers commit one continuation and recover its lost acknowledgement after restart",
	[markdownWork(), workerAnswerAcknowledgementLost()],
	function* ({ fleet, prepareWork, afterRestart, launches, providerCalls, askWorker, answerWorker }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const { decision } = yield* askWorker();
		const answer = yield* answerWorker(decision);
		yield* Effect.all(
			[fleet.resolve("one", decision.id, answer.id).pipe(Effect.result), fleet.resolve("one", decision.id, answer.id).pipe(Effect.result)],
			{ concurrency: "unbounded" },
		);
		const intent = (yield* fleet.get("one")).value;
		expect(intent.attempts.map((entry) => entry.operationId)).toEqual(["operation-1", "operation-2"]);
		expect(intent.attempts.at(-1)?.receipt).toBeUndefined();
		expect(intent.attempts.at(-1)?.sessionId).toBe(decision.worker?.sessionId);
		expect(intent.attempts.at(-1)?.prompt).toBe(answer.body);
		expect(intent.responses).toMatchObject([{ decisionId: decision.id, responseId: answer.id }]);
		yield* afterRestart(
			Effect.gen(function* () {
				const restarted = yield* Fleet;
				const recovered = yield* restarted.reconcile("one");
				expect(recovered.value.step).toBe("working");
				expect(recovered.value.attempts.at(-1)?.receipt?.sessionId).toBe(decision.worker?.sessionId);
				yield* restarted.resolve("one", decision.id, answer.id);
			}),
		);
		expect(launches()).toEqual(["operation-1"]);
		expect(
			providerCalls()
				.filter((call) => call.call === "turn")
				.map((call) => call.operationId),
		).toEqual(["operation-1", "operation-2"]);
	},
);

for (const type of ["clarify", "not_now"] as const) {
	isolatedEngine.it(
		`${type} keeps the worker question open until an explicit superseding answer`,
		[markdownWork()],
		function* ({ fleet, prepareWork, providerCalls, askWorker, answerWorker }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision } = yield* askWorker();
			const deferred = yield* answerWorker(decision, "response.deferred", type);
			expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");
			expect(
				providerCalls()
					.filter((call) => call.call === "turn")
					.map((call) => call.operationId),
			).toEqual(["operation-1"]);
			const answer = yield* answerWorker(decision, "response.superseding", "answer", deferred.id);
			expect((yield* fleet.reconcile("one")).value.step).toBe("working");
			expect((yield* fleet.get("one")).value.attempts.at(-1)?.prompt).toBe(answer.body);
			expect(
				providerCalls()
					.filter((call) => call.call === "turn")
					.map((call) => call.operationId),
			).toEqual(["operation-1", "operation-2"]);
		},
	);
}

isolatedEngine.it(
	"closing the Board task supersedes competing worker answers",
	[markdownWork()],
	function* ({ fleet, prepareWork, providerCalls, source, askWorker, answerWorker, writeBoardWork }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const { decision } = yield* askWorker();
		yield* answerWorker(decision, "response.first");
		yield* answerWorker(decision, "response.second", "answer", undefined, "orchestrator");
		const competing = yield* fleet.reconcile("one");
		expect(competing.value.step).toBe("waiting");
		expect(competing.value.blocker).toContain("Several Board answers compete");
		writeBoardWork("one.md", source.replace("kind: task", "kind: task\nstatus: done\nnext_action: Work completed."));
		const stale = yield* fleet.reconcile("one");
		expect(stale.value.step).toBe("released");
		expect(stale.value.releaseReason).toBe("Board status is done");
		expect(stale.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: decision.published }]);
		expect(
			providerCalls()
				.filter((call) => call.call === "turn")
				.map((call) => call.operationId),
		).toEqual(["operation-1"]);
	},
);

isolatedEngine.it(
	"worker question publication retries the stored exact question without another worker launch",
	[decisionPublicationFailsOnce()],
	function* ({ workerReports, fleet, prepareWork, afterRestart, launches, publishedDecisions }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		workerReports(`FLEET_QUESTION: ${QUESTION}`);
		const failed = yield* fleet.reconcile("one");
		expect(failed.value.decisionPublished).toBe(false);
		expect(failed.value.decision?.reason).toBe(QUESTION);
		expect(failed.value.decision?.worker).toEqual(failed.value.attempts[0]?.receipt);
		yield* afterRestart(
			Effect.gen(function* () {
				const restarted = yield* Fleet;
				const recovered = yield* restarted.reconcile("one");
				expect(recovered.value.step).toBe("waiting");
				expect(recovered.value.decisionPublished).toBe(true);
				expect(recovered.value.decision?.reason).toBe(QUESTION);
			}),
		);
		expect(publishedDecisions()).toEqual([QUESTION]);
		expect(launches()).toEqual(["operation-1"]);
	},
);
