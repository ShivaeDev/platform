import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { appliedAnswer, dispatchAndWait } from "#test/daemonActions.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const TEXT = "Use PostgreSQL and retain the transaction boundary.";

for (const type of ["clarify", "not_now"] as const) {
	for (const release of [false, true]) {
		const args = release ? ["--release"] : [TEXT];
		const stage = release ? "released" : "executing";
		const action = release ? "release" : "continue";
		const observations = release ? 1 : 2;
		postgresTests("live")(`a CLI ${release ? "release" : "text"} answer applies after a reconciled ${type} response`, () =>
			withHost({ "one.md": task("one", "approved") }, {}, (fixture) => {
				const answer = Effect.fn("AnswerSpec.answer")(function* (port: number) {
					const client = yield* daemonClient(port);
					yield* dispatchAndWait(client, "one");
					const { decision } = yield* askWorker(fixture.provider);
					const deferred = yield* answerWorker(fixture.host.boardDir, decision, `response.worker.${type}`, type);
					const waiting = yield* client("fleet.reconcile", { workId: "one" });
					expect(waiting.stage).toBe("needs-human");
					expect(waiting.decision?.id).toBe(decision.id);
					expect(waiting.responses).toMatchObject([{ decisionId: decision.id, responseId: deferred.id, type }]);
					const command = ["answer", "one", ...args, "--port", String(port)];
					expect(yield* Effect.promise(() => cliProcess(command))).toEqual({ code: 0, stdout: `one needs-human: ${ANSWER_RECORDED}` });
					const applied = yield* appliedAnswer(client, "one");
					expect(applied.stage).toBe(stage);
					expect(applied.responses).toMatchObject([
						{ decisionId: decision.id, responseId: deferred.id, type },
						{ action, boardAcknowledged: true, decisionId: decision.id, type: "answer" },
					]);
					expect(applied.responses?.at(-1)?.responseId).not.toBe(deferred.id);
					expect(fixture.provider.launched).toHaveLength(1);
					expect(fixture.provider.observations.size).toBe(observations);
					if (!release) {
						expect(applied.attempts.at(-1)?.prompt).toBe(TEXT);
					}
				});
				return withReadDaemon(fixture.host, answer, { parts: fixture.parts });
			}),
		);
	}
}
