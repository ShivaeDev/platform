import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { resolveHost } from "#host/config.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubMergeQueue } from "#host/githubMergeQueue.ts";
import { type EngineStory, newEngineState } from "#test/engineState.ts";
import { engineDefinition } from "#test/engineStory.ts";
import { engineVerbs } from "#test/engineVerbs.ts";
import { mergeQueueApi } from "#test/mergeQueueApi.ts";
import { syntheticDatabase } from "#test/syntheticDatabase.ts";

export const mergeLoop = storyKit({
	...engineDefinition,
	around: withIsolatedDatabase,
	create: () => {
		const state: EngineStory & { pendingChecks: boolean; queueApi: Effect.Success<typeof mergeQueueApi> | undefined } = {
			...newEngineState(),
			pendingChecks: false,
			queueApi: undefined,
		};
		state.options = { now: () => state.now };
		return state;
	},
	verbs: (state, story) => ({
		...engineVerbs(state, story),
		dequeue: (number: string) => {
			state.queueApi?.dequeue(number);
			story.tell(`GitHub removes PR ${number} from its queue`);
		},
		loseQueueReply: () => {
			state.queueApi?.loseReply();
			story.tell("GitHub accepts auto-merge but loses its reply");
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
			Effect.sync(() => ({
				evidence: ["Required CI for the observed head"],
				head: result.head,
				passed: !state.pendingChecks,
				pending: state.pendingChecks,
			})),
		queue: (work, result, queued) => {
			api.observe(work, result);
			return queue(work, result, queued).pipe(Effect.provideService(GithubApi, api.client));
		},
	};
});

export const fullPrLimit = mergeLoop.trait("configuration", "one open PR stops new implementers", (state) => {
	state.options = { ...state.options, openPullRequests: { ease: 0, floor: 0, max: 1 } };
});
