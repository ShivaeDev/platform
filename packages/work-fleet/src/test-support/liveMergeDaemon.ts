import { NodeServices } from "@effect/platform-node";
import { Effect, Layer, Option, Stream } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { GithubApi } from "#host/githubApi.ts";
import { githubChecks } from "#host/githubChecks.ts";
import { githubMergeQueue } from "#host/githubMergeQueue.ts";
import type { BoardWork } from "#policy.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { engineProvider } from "#test/engineProvider.ts";
import { task } from "#test/fleetHost.ts";
import { HEAD } from "#test/githubResult.ts";
import { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { hostVerbs } from "#test/hostVerbs.ts";
import { mergeQueueApi } from "#test/mergeQueueApi.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";

const layer = Layer.merge(postgresLayer, NodeServices.layer);

function workerResult(api: Effect.Success<typeof mergeQueueApi>, work: BoardWork) {
	const result = { head: HEAD, kind: "change" as const, paths: ["src/one.ts"], pr: "https://github.com/example/project/pull/1" };
	api.observe(work, result);
	return Effect.succeed(result);
}

export const liveMergeDaemon = storyKit({
	after: { configuration: ({ engine }: { engine: HostStoryEngine }) => engine.deploy() },
	around: withIsolatedDatabase,
	clock: "live",
	create: () =>
		Effect.gen(function* () {
			const engine = new HostStoryEngine();
			const api = yield* mergeQueueApi;
			engine.files = { "one.md": task("one", "approved") };
			engine.config = { intervalSeconds: 1, worker: { branchPrefix: "worker-", sharedEnvironment: "/synthetic/env.sh" } };
			engine.providerFixture = engineProvider({ reviewRunning: true }, []);
			engine.provider = engine.providerFixture.transport;
			engine.beforeStart = (fixture) => {
				const queue = githubMergeQueue(fixture.host);
				engine.integrations = engineIntegrations(
					{
						checksQuery: githubChecks(api.client),
						denyDelivery: true,
						queue: (work, result, queued, at) => queue(work, result, queued, at).pipe(Effect.provideService(GithubApi, api.client)),
						resultQuery: (work) => workerResult(api, work),
					},
					[],
				);
				api.mergeGroupCheck(HEAD, { conclusion: "success", name: "verify", url: "https://github.com/example/project/pull/1/checks" });
				return Effect.void;
			};
			return { api, engine };
		}),
	inspect: ({ api, engine }) => ({ ...engine.inspect(), queued: api.queued(), requests: api.requests() }),
	layer,
	name: "Fleet live merge daemon",
	runIf: postgresEnabled,
	stages: ["configuration"],
	verbs: ({ api, engine }, story) => ({
		...hostVerbs(engine, story.tell),
		awaitQueued: () =>
			engine.running.client("daemon.follow", { follow: true, workIds: ["one"] }).pipe(
				Stream.mapEffect(() => engine.running.client("fleet.get", { workId: "one" })),
				Stream.filter((record) => record.mergeQueue?.status === "queued"),
				Stream.runHead,
				Effect.map(Option.getOrThrow),
				Effect.timeout("50 seconds"),
			),
		queuedPullRequests: () => api.queued(),
		queueRequests: () => api.requests(),
	}),
});

export const advisoryReview = liveMergeDaemon.trait("configuration", "reviews advise without blocking delivery", ({ engine }) => {
	engine.config = { ...engine.config, review: "advisory" };
});
