import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { appliedAnswer, dispatchAndWait } from "#test/daemonActions.ts";
import { cliProcess } from "#test/fleetCli.ts";
import type { HostFixture } from "#test/fleetHost.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const TEXT = "Use PostgreSQL and retain the transaction boundary.";

export const answerAfterDeferral = Effect.fn("AnswerTest.answerAfterDeferral")(function* (
	fixture: HostFixture,
	port: number,
	type: "clarify" | "not_now",
	release: boolean,
) {
	const client = yield* daemonClient(port);
	yield* dispatchAndWait(client, "one");
	const { decision } = yield* askWorker(fixture.provider);
	const deferred = yield* answerWorker(fixture.host.boardDir, decision, `response.worker.${type}`, type);
	const waiting = yield* client("fleet.reconcile", { workId: "one" });
	expect(waiting.stage).toBe("needs-human");
	expect(waiting.decision?.id).toBe(decision.id);
	expect(waiting.responses).toMatchObject([{ decisionId: decision.id, responseId: deferred.id, type }]);
	const args = ["answer", "one", ...(release ? ["--release"] : [TEXT]), "--port", String(port)];
	expect(yield* Effect.promise(() => cliProcess(args))).toEqual({ code: 0, stdout: `one needs-human: ${ANSWER_RECORDED}` });
	const applied = yield* appliedAnswer(client, "one");
	expect(applied.stage).toBe(release ? "released" : "executing");
	expect(applied.responses).toMatchObject([
		{ decisionId: decision.id, responseId: deferred.id, type },
		{ action: release ? "release" : "continue", boardAcknowledged: true, decisionId: decision.id, type: "answer" },
	]);
	expect(applied.responses?.at(-1)?.responseId).not.toBe(deferred.id);
	expect(fixture.provider.launched).toHaveLength(1);
	expect(fixture.provider.observations.size).toBe(release ? 1 : 2);
	if (!release) {
		expect(applied.attempts.at(-1)?.prompt).toBe(TEXT);
	}
});
