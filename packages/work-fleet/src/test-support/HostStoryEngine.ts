import { type Clock, Context, Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { HostConfig } from "#host/config.ts";
import type { MainSnapshot } from "#host/mainSource.ts";
import type { FleetRecord } from "#model.ts";
import { daemonResources } from "#test/daemonResources.ts";
import { type HostFixture, hostFixture } from "#test/fleetHost.ts";
import type { Follower } from "#test/followerProcess.ts";
import { HostStoryScenario } from "#test/HostStoryScenario.ts";
import { hostDatabase } from "#test/hostDatabase.ts";
import { diagnosticClock, hostScenarioParts, hostStoryDaemon } from "#test/hostStoryRuntime.ts";
import { localBoardHost } from "#test/localBoardHost.ts";
import { movingMainSource } from "#test/mainSource.ts";
import type { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { questionPublicationBoard } from "#test/questionPublicationVerbs.ts";
import { type SnapshotReads, snapshotReads } from "#test/snapshotReads.ts";
import { type HostDaemon, startHostDaemon } from "#test/startHostDaemon.ts";
import { storeState } from "#test/storeState.ts";

export class HostStoryEngine extends HostStoryScenario {
	files: Record<string, string> = {};
	config: Partial<HostConfig> = {};
	stored: Record<string, Readonly<Record<string, unknown>> & { readonly stage: FleetRecord["stage"] }> = {};
	main: MainSnapshot | undefined;
	integrations: HostFixture["parts"]["integrations"];
	provider: HostFixture["parts"]["provider"] | undefined;
	workerContexts: Context.Context<never>[] | undefined;
	pullRequest: Effect.Success<ReturnType<typeof mergedReviewGithub>> | undefined;
	localBoard = false;

	repositoryRoot: string | undefined;
	briefParseCount: (() => number) | undefined;
	questionRegistrationClock: Clock.Clock | undefined;
	readonly followers = new Map<string, Follower>();
	readonly snapshots: unknown[] = [];
	reads: SnapshotReads | undefined;
	resources: Effect.Success<ReturnType<typeof daemonResources>> | undefined;
	#fixture: HostFixture | undefined;
	#runtime: HostDaemon | undefined;
	#subscribed = Promise.withResolvers<void>();

	get observedProvider() {
		return this.providerFixture ?? this.fixture.provider;
	}
	get fixture() {
		if (this.#fixture === undefined) {
			throw new Error("The host has not been created");
		}
		return this.#fixture;
	}

	get running() {
		if (this.#runtime === undefined) {
			throw new Error("Start the daemon before using it");
		}
		return this.#runtime;
	}

	get subscribed() {
		return this.#subscribed.promise;
	}

	get fleet() {
		return Context.get(this.running.context, Fleet);
	}

	get observedMain() {
		if (this.main === undefined) {
			throw new Error("Configure moving main before reading its observation");
		}
		return this.main;
	}

	deploy() {
		const engine = this;
		return Effect.gen(function* () {
			if (engine.localBoard) {
				const local = localBoardHost(yield* hostFixture({}, engine.config), engine.localBoardOptions);
				engine.repositoryRoot = local.repositoryRoot;
				engine.#fixture = local.fixture(engine.files);
			} else {
				engine.#fixture = yield* hostFixture(engine.files, engine.config);
			}
			for (const [workId, record] of Object.entries(engine.stored)) {
				yield* engine.store(workId, record);
			}
			engine.resources = yield* daemonResources(engine.provider ?? engine.fixture.parts.provider, undefined, engine.workerContexts);
			engine.reads = snapshotReads(engine.fixture.host);
			if (engine.beforeStart !== undefined) {
				yield* engine.beforeStart(engine.fixture);
			}
			if (!engine.deferStart) {
				yield* engine.start();
			}
		});
	}

	start(port = 0) {
		const engine = this;
		return Effect.gen(function* () {
			if (engine.#runtime !== undefined) {
				return yield* Effect.die("The daemon is already running");
			}
			const resources = engine.resources;
			const reads = engine.reads;
			if (resources === undefined || reads === undefined) {
				return yield* Effect.die("Deploy the host before starting it");
			}
			const board = questionPublicationBoard(engine);
			const handlerClock = yield* diagnosticClock(engine);
			const parts = hostScenarioParts(engine, { ...engine.fixture.parts, ...(board === undefined ? {} : { board }), provider: resources.provider });
			if (engine.integrations !== undefined) {
				parts.integrations = engine.integrations;
			}
			if (engine.main !== undefined) {
				parts.main = movingMainSource(() => engine.observedMain, engine.repositoryRoot);
			}
			engine.#subscribed = Promise.withResolvers<void>();
			engine.runningParts = parts;
			engine.#runtime = yield* reads.observe(startHostDaemon(hostStoryDaemon(engine, parts, port, handlerClock, () => engine.#subscribed.resolve())));
		});
	}

	stop() {
		const engine = this;
		return Effect.gen(function* () {
			yield* engine.running.stop;
			engine.#runtime = undefined;
		});
	}

	store(workId: string, record: Readonly<Record<string, unknown>> & { readonly stage: FleetRecord["stage"] }) {
		const effect = storeState(this.fixture.host, workId, record);
		return this.#runtime === undefined
			? effect.pipe(Effect.provide(hostDatabase(this.fixture.host, "fleet-story-seed", 1)))
			: effect.pipe(Effect.provideContext(this.#runtime.context));
	}

	inspect() {
		return {
			followers: Object.fromEntries([...this.followers].map(([name, follower]) => [name, { errors: follower.errors(), output: follower.output() }])),
			port: this.#runtime?.port,
			provider: this.#fixture?.provider.starts,
			snapshots: this.snapshots,
		};
	}
}
