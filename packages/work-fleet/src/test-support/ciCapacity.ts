import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { NodeServices } from "@effect/platform-node";
import { Clock, Effect, Layer, Schema } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import type { HostSettings } from "#host/config.ts";
import { hostProvider } from "#host/providers.ts";
import { ciCapacityCloud } from "#test/ciCapacityCloud.ts";
import { until } from "#test/cloudRestart.ts";
import { codexServer } from "#test/codex.ts";
import { authFolder, FUTURE_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { hostFixture, task } from "#test/fleetHost.ts";
import { syntheticGithub } from "#test/githubApi.ts";
import { fixedMainSource } from "#test/mainSource.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";
import { startHostDaemon } from "#test/startHostDaemon.ts";

const ENDPOINT = "repos/example/project/actions/runs?status=queued&per_page=1";

const layer = Layer.merge(postgresLayer, NodeServices.layer);

export const ciCapacity = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const github = syntheticGithub();
		github.reply(ENDPOINT, { "total_count": 0 });
		const cloud = ciCapacityCloud();
		const backend = yield* codexServer(cloud.handle);
		const authFile = yield* authFolder(syntheticToken("current", FUTURE_EXPIRY));
		const config = {
			cloud: { authFile, cwd: SYNTHETIC_WORKSPACE, endpoint: backend.endpoint, environmentId: SYNTHETIC_ENVIRONMENT },
			intervalSeconds: 15,
			launch: { serviceTier: { ciCapacity: { fastAt: 2, slowAt: 5 } } },
			provider: "cloud" as const,
			worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" },
		};
		const fixture = yield* hostFixture(Object.fromEntries(["one", "two", "three", "four"].map((id) => [`${id}.md`, task(id, "approved")])), config);
		const root = fixture.host.boardDir;
		execFileSync("git", ["init", "--quiet", root]);
		execFileSync("git", ["remote", "add", "origin", "https://github.com/example/project.git"], { cwd: root });
		const time = { offset: 0 };
		const live = yield* Clock.Clock;
		const clock: Clock.Clock = {
			currentTimeMillis: Effect.sync(() => live.currentTimeMillisUnsafe() + time.offset),
			currentTimeMillisUnsafe: () => live.currentTimeMillisUnsafe() + time.offset,
			currentTimeNanos: live.currentTimeNanos,
			currentTimeNanosUnsafe: () => live.currentTimeNanosUnsafe(),
			monotonicTimeNanos: live.monotonicTimeNanos,
			monotonicTimeNanosUnsafe: () => live.monotonicTimeNanosUnsafe(),
			sleep: (duration) => live.sleep(duration),
		};
		const daemon = yield* startHostDaemon(
			readDaemonLayer(fixture.host, {
				parts: { ...fixture.parts, github: github.layer, main: fixedMainSource({ repositoryRoot: root }), provider: hostProvider(fixture.host) },
			}).pipe(Layer.provide(Layer.succeed(Clock.Clock)(clock))),
		);
		return { clock, cloud, daemon, fixture, github, time };
	},
	layer,
	name: "CI capacity service tier",
	runIf: postgresEnabled,
	stages: [],
	verbs: (state, story) => ({
		cliStatus: () => Effect.promise(() => cliProcess(["status", "--port", String(state.daemon.port)])),
		complete: () => state.cloud.complete(),
		dispatch: (workId: string) =>
			Effect.gen(function* () {
				story.tell(`dispatch ${workId} through the daemon`);
				yield* state.daemon.client("daemon.dispatch", { workId });
				yield* until(() => state.daemon.client("daemon.dispatch-status", { workId }).pipe(Effect.map((request) => request?.status !== "pending")));
			}),
		failRead: () => {
			story.tell("GitHub refuses queued-run reads");
			state.github.reply(ENDPOINT, { message: "Unavailable" }, { status: HttpStatus.fromLiteral("ServiceUnavailable") });
		},
		intervalPasses: () =>
			Effect.gen(function* () {
				story.tell("one daemon interval passes and its scheduler runs");
				state.time.offset += state.fixture.host.interval * 1000;
				yield* cycle.pipe(Effect.provideContext(state.daemon.context), Effect.provideService(Clock.Clock, state.clock));
			}),
		launches: () =>
			state.cloud.requests
				.filter(({ method }) => method === "thread/start")
				.map(({ params }) => Schema.decodeUnknownSync(Schema.Struct({ serviceTier: Schema.optional(Schema.String) }))(params).serviceTier),
		launchSetting: (launch: HostSettings["launch"]) =>
			Effect.gen(function* () {
				story.tell("change the host launch setting");
				const config = JSON.parse(readFileSync(state.fixture.configFile, "utf8"));
				state.fixture.write("fleet.config.json", JSON.stringify({ ...config, launch }));
				yield* until(() =>
					state.daemon
						.client("daemon.status", {})
						.pipe(Effect.map((status) => JSON.stringify(status.config?.settings.launch) === JSON.stringify(launch))),
				);
			}),
		queuedRuns: (count: number) => {
			story.tell(`GitHub reports ${count} queued CI runs`);
			state.github.reply(ENDPOINT, { "total_count": count });
		},
		reconcile: (workId: string) =>
			Effect.flatMap(Fleet, (fleet) => fleet.reconcile(workId)).pipe(
				Effect.provideContext(state.daemon.context),
				Effect.provideService(Clock.Clock, state.clock),
			),
		record: (workId: string) => state.daemon.client("fleet.get", { workId }),
		recordedTier: (workId: string) =>
			state.daemon.client("fleet.get", { workId }).pipe(Effect.map((record) => record.attempts[0]?.settings?.serviceTier)),
		repair: (workId: string) =>
			Effect.flatMap(Fleet, (fleet) => fleet.continue(workId, "Complete the approved work")).pipe(
				Effect.provideContext(state.daemon.context),
				Effect.provideService(Clock.Clock, state.clock),
			),
		requests: () => state.github.requests.map(({ endpoint }) => endpoint),
		reserveBudget: () => {
			story.tell("the queued-run response leaves GitHub below Fleet's reserve");
			state.github.budget.remaining = 999;
			state.github.reply(ENDPOINT, { "total_count": 5 });
		},
		sent: (method: string) => state.cloud.requests.filter((request) => request.method === method).map(({ params }) => params),
		status: () => state.daemon.client("daemon.status", {}),
	}),
});
