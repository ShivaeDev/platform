import { execFileSync } from "node:child_process";
import { NodeServices } from "@effect/platform-node";
import { Clock, Effect, Layer, Queue } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { cycle } from "#engine/scheduler.ts";
import { SessionTransport } from "#session/service.ts";
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
		const config = { intervalSeconds: 15, launch: { serviceTier: { ciCapacity: { fastAt: 2, slowAt: 5 } } } };
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
		const turns = yield* Queue.unbounded<string>();
		const provider = Layer.effect(SessionTransport)(
			Effect.map(SessionTransport, (transport) => ({
				...transport,
				startTurn: (input: Parameters<typeof transport.startTurn>[0]) =>
					transport.startTurn(input).pipe(Effect.tap(() => Queue.offer(turns, input.operationId))),
			})),
		).pipe(Layer.provide(fixture.parts.provider));
		const daemon = yield* startHostDaemon(
			readDaemonLayer(fixture.host, {
				parts: { ...fixture.parts, github: github.layer, main: fixedMainSource({ repositoryRoot: root }), provider },
			}).pipe(Layer.provide(Layer.succeed(Clock.Clock)(clock))),
		);
		return { clock, daemon, fixture, github, time, turns };
	},
	layer,
	name: "CI capacity service tier",
	runIf: postgresEnabled,
	stages: [],
	verbs: (state, story) => ({
		cliStatus: () => Effect.promise(() => cliProcess(["status", "--port", String(state.daemon.port)])),
		dispatch: (workId: string) =>
			Effect.gen(function* () {
				story.tell(`dispatch ${workId} through the daemon`);
				yield* state.daemon.client("daemon.dispatch", { workId });
				yield* Queue.take(state.turns);
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
		launches: () => state.fixture.provider.starts.map(({ settings }) => settings?.serviceTier),
		queuedRuns: (count: number) => {
			story.tell(`GitHub reports ${count} queued CI runs`);
			state.github.reply(ENDPOINT, { "total_count": count });
		},
		recordedTier: (workId: string) =>
			state.daemon.client("fleet.get", { workId }).pipe(Effect.map((record) => record.attempts[0]?.settings?.serviceTier)),
		requests: () => state.github.requests.map(({ endpoint }) => endpoint),
		reserveBudget: () => {
			story.tell("the queued-run response leaves GitHub below Fleet's reserve");
			state.github.budget.remaining = 999;
			state.github.reply(ENDPOINT, { "total_count": 5 });
		},
		status: () => state.daemon.client("daemon.status", {}),
	}),
});
