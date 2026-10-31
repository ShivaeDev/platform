import { NodeServices } from "@effect/platform-node";
import { Clock, Effect, Layer } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { cycle } from "#engine/scheduler.ts";
import { daemonLayer } from "#host/daemon.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubMergeQueue } from "#host/githubMergeQueue.ts";
import type { FleetRecord } from "#model.ts";
import { BoardGateway } from "#policy.ts";
import { waitForRecord } from "#test/daemonActions.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { hostFixture, readHostWork, task } from "#test/fleetHost.ts";
import { mergeQueueApi } from "#test/mergeQueueApi.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";
import { startHostDaemon } from "#test/startHostDaemon.ts";
import { statusRecord } from "#test/status.ts";
import { storeState } from "#test/storeState.ts";

const layer = Layer.merge(postgresLayer, NodeServices.layer);

export const parkedMergeDaemon = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () =>
		Effect.gen(function* () {
			const fixture = yield* hostFixture(
				{ "one.md": task("one", "approved"), "two.md": task("two", "approved") },
				{ intervalSeconds: 3600, worker: { branchPrefix: "worker-", sharedEnvironment: "/synthetic/env.sh" } },
			);
			const api = yield* mergeQueueApi;
			const queue = githubMergeQueue(fixture.host);
			const integrations = engineIntegrations(
				{
					denyDelivery: true,
					queue: (work, result, queued, queuedAt) => queue(work, result, queued, queuedAt).pipe(Effect.provideService(GithubApi, api.client)),
				},
				[],
			);
			const parts = { ...fixture.parts, integrations };
			const daemon = yield* startHostDaemon(readDaemonLayer(fixture.host, { parts }));
			const seed = Effect.fnUntraced(function* (id: string, number: string) {
				const work = yield* readHostWork(fixture, id).pipe(Effect.provideContext(daemon.context));
				const result = {
					head: `reviewed-${id}`,
					kind: "change" as const,
					paths: [`src/${id}.ts`],
					pr: `https://github.com/example/project/pull/${number}`,
				};
				api.observe(work, result);
				api.mergeGroupCheck(result.head, { conclusion: "success", name: "verify", url: `${result.pr}/checks` });
				const decision = {
					code: "reviewed-pr-ready" as const,
					id: `${id}.ready`,
					links: [result.pr],
					reason: "Reviewed PR is ready to merge",
					recommendation: "Merge the reviewed, green PR",
				};
				const published = yield* Effect.flatMap(BoardGateway, (board) => board.decision(id, decision, work)).pipe(
					Effect.provideContext(daemon.context),
				);
				const record = {
					...statusRecord(id, "waiting"),
					boardContext: work.context,
					boardRevision: work.revision,
					boardSourcePath: work.sourcePath,
					checks: { evidence: ["Required CI passed"], head: result.head, passed: true },
					decision: { ...decision, published },
					mergeReadyAt: (yield* Clock.currentTimeMillis) - 3_600_000,
					mergeReadyHead: result.head,
					result,
					review: {
						evidence: ["Independent review approved the head"],
						head: result.head,
						receipt: { sessionId: `review-${id}`, turnId: `review-${id}` },
						repairPrompt: "",
						verdict: "approved",
					},
				} satisfies FleetRecord;
				yield* storeState(fixture.host, id, record).pipe(Effect.provideContext(daemon.context));
			});
			yield* seed("one", "1");
			yield* seed("two", "2");
			return { api, daemon, fixture, parts };
		}).pipe(Effect.provide(NodeServices.layer)),
	inspect: (state) => ({ queued: state.api.queued(), requests: state.api.requests() }),
	layer,
	name: "Fleet parked reviewed PRs",
	runIf: postgresEnabled,
	stages: ["configuration"],
	verbs: (state, story) => ({
		get: (workId: string) => state.daemon.client("fleet.get", { workId }),
		queuedPullRequests: () => state.api.queued(),
		queueRequests: () => state.api.requests(),
		restart: () =>
			Effect.gen(function* () {
				story.tell("restart the daemon with its scheduler and the same parked records");
				yield* state.daemon.stop;
				state.daemon = yield* startHostDaemon(daemonLayer(state.fixture.host, state.parts, 0));
			}).pipe(Effect.provide(NodeServices.layer)),
		sweep: () => {
			story.tell("run a scheduler sweep with no PR event");
			return cycle.pipe(Effect.provideContext(state.daemon.context), Effect.provide(NodeServices.layer));
		},
		waitForQueued: (workId: string) => waitForRecord(state.daemon.client, workId, (record) => record.mergeQueue?.status === "queued"),
	}),
});
