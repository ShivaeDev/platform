import { execFileSync } from "node:child_process";
import { Effect } from "effect";
import { hostScheduler } from "#host/commands.ts";
import { daemonRequest } from "#host/daemonClient.ts";
import { boardAskFiles } from "#test/boardHttp.ts";
import { waitForDispatch } from "#test/daemonActions.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import type { HostDaemon } from "#test/startHostDaemon.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

export function hostCommandVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	const request: HostDaemon["client"] = (...args) => engine.running.client(...args);
	return {
		acknowledgeAnswer: (workId: string) =>
			daemonRequest(engine.running.port, (client) => client("daemon.answer", { workId }), `answer ${workId}`, 1500),
		acknowledgeDispatch: (workId: string) =>
			daemonRequest(engine.running.port, (client) => client("daemon.dispatch", { workId }), `dispatch ${workId}`, 1500),
		boardQuestions: (owner?: string) => boardAskFiles(engine.fixture.host.boardDir, owner),
		continue: (workId: string, message: string) => {
			tell(`continue ${workId} on its existing session`);
			return engine.running.client("fleet.continue", { message, workId });
		},
		deferWorker: (decision: Parameters<typeof answerWorker>[1]) => answerWorker(engine.fixture.host.boardDir, decision, "response.defer", "not_now"),
		dispatchOutcome: (workId: string) => waitForDispatch(engine.running.client, workId),
		initializeRepository: () => execFileSync("git", ["init", "--quiet", "--initial-branch=main", engine.fixture.host.boardDir]),
		list: () => engine.fleet.list(),
		logs: () => engine.logs.entries,
		providerObservation: (turnId: string) => engine.observedProvider.observations.get(turnId),
		providerPrompts: () => [...engine.observedProvider.observations.values()].map((observation) => observation.output),
		request,
		startScheduler: () => hostScheduler(engine.fixture.host).pipe(Effect.provideContext(engine.running.context), Effect.forkScoped),
		workerQuestion: (workId = "one") => askWorker(engine.observedProvider, workId).pipe(Effect.provideContext(engine.running.context)),
	};
}
