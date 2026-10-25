import type { FleetRecord } from "#model.ts";
import type { AnswerHostEngine } from "#test/AnswerHostEngine.ts";

export function answerPullRequestVerbs(engine: AnswerHostEngine) {
	return {
		answerPullRequest: (record: FleetRecord, text: string) => engine.running.client("fleet.resolve", engine.pullRequest.answer(record, text)),
		finishPullRequestTurn: (record: FleetRecord, head?: string) => engine.pullRequest.finishWorker(record, head),
		launchedSessions: () => [...engine.host.provider.launched],
		movePullRequestBase: (revision: string) => {
			engine.pullRequest.github.state.base = revision;
		},
		providerObservation: (turnId: string) => engine.host.provider.observations.get(turnId),
		publishPullRequestResponse: (record: FleetRecord, text: string, author?: string) => engine.pullRequest.answer(record, text, author),
		pullRequestBase: () => engine.pullRequest.github.state.base,
		pullRequestHead: () => engine.pullRequest.github.state.head,
		pullRequestUrl: () => engine.pullRequest.PR,
		readyPullRequest: () => engine.pullRequest.ready(engine.running.client),
		setMergeable: (mergeable: "CONFLICTING" | "MERGEABLE" | "UNKNOWN") => {
			engine.pullRequest.github.state.mergeable = mergeable;
		},
		workerStarted: (role: "worker" | "repair") => engine.pullRequest.started(engine.running.client, role),
	};
}
