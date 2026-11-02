import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { resolveHost } from "#host/config.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubCiHold } from "#host/githubCiHold.ts";
import { githubMergeQueue } from "#host/githubMergeQueue.ts";
import { type EngineStory, newEngineState } from "#test/engineState.ts";
import { engineDefinition } from "#test/engineStory.ts";
import { engineVerbs } from "#test/engineVerbs.ts";
import { mergeQueueApi } from "#test/mergeQueueApi.ts";
import { releaseWindowVerbs } from "#test/releaseWindowVerbs.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";

export const mergeLoop = storyKit({
	...engineDefinition,
	around: withIsolatedDatabase,
	create: () => {
		const state: EngineStory & {
			failedChecks: Map<string, { name: string; output: string }>;
			pendingChecks: boolean;
			queueApi: Effect.Success<typeof mergeQueueApi> | undefined;
		} = {
			...newEngineState(),
			failedChecks: new Map(),
			pendingChecks: false,
			queueApi: undefined,
		};
		state.options = { now: () => state.now };
		return state;
	},
	verbs: (state, story) => ({
		...engineVerbs(state, story),
		...releaseWindowVerbs(state, story.tell),
		advanceMainDuringFiles: () => {
			if (state.queueApi === undefined) {
				throw new Error("No GitHub queue API is configured");
			}
			state.queueApi.advanceMainDuringFiles();
			story.tell("GitHub advances main during the next PR changed-files read");
		},
		autoMergePullRequests: () => state.queueApi?.autoMerges(),
		dequeue: (number: string, reason: string, commit?: string, at = state.now) => {
			state.queueApi?.dequeue(number, reason, commit, at);
			story.tell(`GitHub removes PR ${number} from its queue: ${reason}`);
		},
		failRequiredCheck: (id: string, name: string, output: string) => {
			state.failedChecks.set(id, { name, output });
			story.tell(`${id}'s required ${name} check fails: ${output}`);
		},
		loseQueueReply: () => {
			state.queueApi?.loseReply();
			story.tell("GitHub accepts auto-merge but loses its reply");
		},
		mergeGroupCheck: (commit: string, check: { name: string; conclusion: string | null; url: string }) => {
			state.queueApi?.mergeGroupCheck(commit, check);
			story.tell(`GitHub reports ${check.name} as ${check.conclusion ?? "pending"} for merge group ${commit}`);
		},
		moveWorkerPath: (id: string, from: string, to: string) => {
			if (state.predictionRepository === undefined || state.queueApi === undefined) {
				throw new Error("Moving a queued worker file requires watched branches and automatic merges");
			}
			state.predictionRepository.move(id, from, to);
			state.queueApi.renameFile(from, to);
			story.tell(`worker ${id} moves ${from} to ${to} and pushes`);
		},
		passRequiredChecks: (number: string) => {
			state.failedChecks.delete(number);
			story.tell(`PR ${number}'s required checks pass`);
		},
		queuedPullRequests: () => state.queueApi?.queued(),
		queueObservation: (number: string, fields: Record<string, unknown>) => {
			state.queueApi?.override(number, fields);
			story.tell(`GitHub changes PR ${number}`);
		},
		queueRequests: () => state.queueApi?.requests(),
		requiredChecksPending: (pending: boolean) => {
			state.pendingChecks = pending;
			story.tell(`Required checks are ${pending ? "pending" : "green"}`);
		},
	}),
});

export const automaticMerges = mergeLoop.trait("configuration", "Fleet queues its reviewed PRs through GitHub HTTP", function* (state) {
	const api = yield* mergeQueueApi;
	state.queueApi = api;
	const host = resolveHost("/synthetic", {
		database: syntheticDatabase,
		provider: "local",
		worker: { branchPrefix: "worker-", sharedEnvironment: "/synthetic/env.sh" },
	});
	const queue = githubMergeQueue(host);
	state.options = {
		...state.options,
		checksQuery: (result) =>
			Effect.sync(() => {
				const failure = state.failedChecks.get(result.kind === "change" ? (result.pr.split("/").at(-1) ?? "") : "");
				return {
					evidence: ["Required CI for the observed head"],
					failedChecks: failure === undefined ? undefined : [failure.name],
					head: result.head,
					passed: !state.pendingChecks && failure === undefined,
					pending: state.pendingChecks,
					repairPrompt: failure?.output,
				};
			}),
		ciHold: (result, approvedHead) => {
			const current = state.predictionRepository?.resultForPr(result.pr);
			if (current !== undefined) {
				api.observe({ workId: current[0] }, current[1]);
			}
			return githubCiHold(result, approvedHead).pipe(Effect.provideService(GithubApi, api.client));
		},
		queue: (work, result, queued, queuedAt, approvedHead) => {
			api.observe(work, state.predictionRepository?.resultForPr(result.pr)?.[1] ?? result);
			return queue(work, result, queued, queuedAt, approvedHead).pipe(Effect.provideService(GithubApi, api.client));
		},
	};
});

export const fullPrLimit = mergeLoop.trait("configuration", "one open PR stops new implementers", (state) => {
	state.options = { ...state.options, openPullRequests: { ease: 0, floor: 0, max: 1 } };
});
