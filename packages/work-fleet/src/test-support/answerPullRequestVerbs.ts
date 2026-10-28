import { rmSync } from "node:fs";
import { join } from "node:path";
import { Context, type Effect } from "effect";
import { withBoardReadPass } from "#board/readPass.ts";
import type { FleetRecord } from "#model.ts";
import { BoardGateway } from "#policy.ts";
import type { AnswerHostEngine } from "#test/AnswerHostEngine.ts";

export function answerPullRequestVerbs(engine: AnswerHostEngine, tell: (line: string) => void) {
	return {
		answerPullRequest: (record: FleetRecord, text: string) => engine.running.client("fleet.resolve", engine.pullRequest.answer(record, text)),
		finishPullRequestTurn: (record: FleetRecord, head?: string) => engine.pullRequest.finishWorker(record, head),
		inBoardScan: <A, E, R>(effect: Effect.Effect<A, E, R>) => withBoardReadPass(effect),
		launchedSessions: () => [...engine.host.provider.launched],
		mergePullRequest: () => {
			tell("observe the reviewed PR merged on GitHub");
			engine.pullRequest.github.state.status = "MERGED";
		},
		movePullRequestBase: (revision: string) => {
			engine.pullRequest.github.state.base = revision;
		},
		providerObservation: (turnId: string) => engine.host.provider.observations.get(turnId),
		publishPullRequestResponse: (record: FleetRecord, text: string, author?: string) => engine.pullRequest.answer(record, text, author),
		pullRequestBase: () => engine.pullRequest.github.state.base,
		pullRequestHead: () => engine.pullRequest.github.state.head,
		pullRequestUrl: () => engine.pullRequest.PR,
		readyPullRequest: () => engine.pullRequest.ready(engine.running.client),
		reconcileScanned: () => {
			tell("reconcile within the existing Board scan");
			return engine.spans.trace(engine.fleet.reconcile("one"));
		},
		removePullRequestResponse: (responseId: string) => {
			tell(`remove Board response ${responseId}`);
			rmSync(join(engine.host.host.boardDir, "responses", `${responseId}.md`));
		},
		resolutionReads: () => engine.spans.count("Fleet.readResolution"),
		scanBoard: () => {
			tell("scan the Board before its response changes");
			return Context.get(engine.running.context, BoardGateway).get("one");
		},
		setMergeable: (mergeable: "CONFLICTING" | "MERGEABLE" | "UNKNOWN") => {
			engine.pullRequest.github.state.mergeable = mergeable;
		},
		workerStarted: (role: "worker" | "repair") => engine.pullRequest.started(engine.running.client, role),
	};
}
