import { Effect } from "effect";
import { daemonRequest } from "#host/daemonClient.ts";
import type { FleetRecord } from "#model.ts";
import type { AnswerHostEngine } from "#test/AnswerHostEngine.ts";
import { pauseAdmission } from "#test/busyAdmission.ts";
import { answerAndWait, appliedAnswer, dispatchAndWait, waitForRecord } from "#test/daemonActions.ts";
import { cliProcess } from "#test/fleetCli.ts";

export function answerHostVerbs(engine: AnswerHostEngine, tell: (line: string) => void) {
	return {
		answer: (text: string, release = false, workId = "one") => {
			tell(`record an answer for ${workId}`);
			return daemonRequest(engine.running.port, (client) => client("daemon.answer", { release, text, workId }), `answer ${workId}`, 500);
		},
		answerAndWait: (text: string, release = false, workId = "one") => answerAndWait(engine.running.client, { release, text, workId }),
		applied: (workId = "one") => appliedAnswer(engine.running.client, workId),
		cliAnswer: (workId: string, text: string, release = false) =>
			Effect.gen(function* () {
				tell(`answer ${workId} through the CLI`);
				let stderr = "";
				const result = yield* Effect.promise(() =>
					cliProcess(["answer", workId, ...(release ? ["--release"] : [text]), "--port", String(engine.running.port)], {
						onError: (chunk) => {
							stderr += chunk;
						},
					}),
				);
				return { ...result, stderr };
			}),
		dispatch: (workId = "one") => {
			tell(`dispatch ${workId}`);
			return dispatchAndWait(engine.running.client, workId);
		},
		follow: (workIds: readonly string[]) => engine.running.client("daemon.follow", { workIds }),
		get: (workId = "one") => engine.running.client("fleet.get", { workId }),
		holdAdmission: () =>
			Effect.gen(function* () {
				tell("hold admission");
				const admission = yield* pauseAdmission(engine.host.host);
				yield* Effect.addFinalizer(() => admission.release);
				return admission;
			}),
		reconcile: (workId = "one") => engine.running.client("fleet.reconcile", { workId }),
		resolve: (decisionId: string, responseId: string, workId = "one") => engine.running.client("fleet.resolve", { decisionId, responseId, workId }),
		responseIndexBuilds: () => engine.spans.count("WorkBoard.searchSnapshot"),
		start: () => {
			tell("start the daemon");
			return engine.start();
		},
		status: () => daemonRequest(engine.running.port, (client) => client("daemon.status", {}), "status", 500),
		stop: () => {
			tell("stop the daemon");
			return engine.stop();
		},
		waitForRecord: (workId: string, ready: (record: FleetRecord) => boolean) => waitForRecord(engine.running.client, workId, ready),
	};
}
