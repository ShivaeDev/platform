import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { oneSubmissionOfQuotaConfiguration } from "#test/oneSubmissionOfQuotaConfiguration.ts";
import { QUESTION } from "#test/workerQuestion.ts";

const oneSubmissionOfQuota = engineConfiguration("one submission of quota", oneSubmissionOfQuotaConfiguration());

engine.it(
	"retry of receiptless preparation cannot authorize an edited brief",
	[markdownWork()],
	function* ({ boardBrief, writeBoardWork, answerReport, prepareWork, fleet }) {
		const source = boardBrief();
		yield* prepareWork("one");
		writeBoardWork("one.md", source.replace("fleet: approved", "fleet: held"));
		const decision = (yield* fleet.dispatch("one")).value.decision;
		if (decision?.published === undefined) {
			return yield* Effect.die("Missing decision");
		}
		const current = `${source}\nNew approved criteria.\n`;
		writeBoardWork("one.md", current);
		const responseId = answerReport(decision.published, "retry");
		const denied = yield* fleet.resolve("one", decision.id, responseId).pipe(Effect.result);
		expect(denied._tag).toBe("Failure");
		const prepared = yield* fleet.get("one");
		expect(prepared.value.step).toBe("waiting");
		expect(prepared.value.boardContext).toBe(source);
		expect(prepared.value.decision).toEqual(decision);
		expect(prepared.value.responses).toBeUndefined();
		expect((yield* fleet.dispatch("one")).value.attempts).toEqual([]);
	},
);

engine.it(
	"an edited brief is approved while its worker answer waits for quota",
	[markdownWork(), oneSubmissionOfQuota],
	function* ({
		boardBrief,
		boardReceiptRecords,
		writeBoardWork,
		answerWorker,
		restartWithPolicy,
		providerCalls,
		workerQuestion,
		prepareWork,
		fleet,
	}) {
		const source = boardBrief();
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* workerQuestion("one", QUESTION);
		const stopped = yield* fleet.reconcile("one");
		const decision = stopped.value.decision;
		if (decision?.published === undefined) {
			return yield* Effect.die("Missing published worker question");
		}
		yield* answerWorker(decision);
		const current = `${source}\nNew approved criteria.\n`;
		writeBoardWork("one.md", current);
		const waiting = yield* fleet.reconcile("one");
		expect(waiting.value.step).toBe("waiting");
		expect(waiting.value.boardContext).toBe(current);
		expect(waiting.value.responses).toBeUndefined();
		yield* restartWithPolicy((policy) => ({ ...policy, quota: { ...policy.quota, available: 100 } }));
		const continued = yield* fleet.reconcile("one");
		expect(continued.value.step).toBe("working");
		expect(continued.value.decision).toBeUndefined();
		expect(continued.value.boardContext).toBe(current);
		expect(continued.value.responses).toMatchObject([{ action: "continue", boardAcknowledged: true }]);
		expect(continued.value.attempts.at(-1)?.prompt).toContain(current);
		expect(
			providerCalls()
				.filter((call) => call.call === "turn")
				.map(({ operationId }) => operationId),
		).toEqual(["operation-1", "operation-2"]);
		expect(boardReceiptRecords()).toMatchObject([{ disposition: "applied", question: decision.published.questionId }]);
	},
);
