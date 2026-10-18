import type { FleetRecord } from "#model.ts";
import type { AnswerHostEngine } from "#test/AnswerHostEngine.ts";

export function answerPullRequestVerbs(engine: AnswerHostEngine) {
	return {
		answerPullRequest: (record: FleetRecord, text: string) => engine.running.client("fleet.resolve", engine.pullRequest.answer(record, text)),
		readyPullRequest: () => engine.pullRequest.ready(engine.running.client),
		setMergeable: (mergeable: "CONFLICTING" | "MERGEABLE") => {
			engine.pullRequest.github.state.mergeable = mergeable;
		},
		workerStarted: (role: "worker" | "repair") => engine.pullRequest.started(engine.running.client, role),
	};
}
