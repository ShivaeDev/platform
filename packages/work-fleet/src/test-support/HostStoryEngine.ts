import { Context, Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { HostConfig } from "#host/config.ts";
import type { MainSnapshot } from "#host/mainSource.ts";
import { daemonResources } from "#test/daemonResources.ts";
import { type HostFixture, hostFixture } from "#test/fleetHost.ts";
import type { Follower } from "#test/followerProcess.ts";
import { hostDatabase } from "#test/hostDatabase.ts";
import { movingMainSource } from "#test/mainSource.ts";
import { readDaemonLayer } from "#test/readDaemon.ts";
import { type SnapshotReads, snapshotReads } from "#test/snapshotReads.ts";
import { type HostDaemon, startHostDaemon } from "#test/startHostDaemon.ts";
import { storeState } from "#test/storeState.ts";

export class HostStoryEngine {
	files: Record<string, string> = {};
	config: Partial<HostConfig> = {};
	stored: Record<string, Readonly<Record<string, unknown>>> = {};
	main: MainSnapshot | undefined;
	briefParseCount: (() => number) | undefined;
	readonly followers = new Map<string, Follower>();
	readonly snapshots: unknown[] = [];
	reads: SnapshotReads | undefined;
	resources: Effect.Success<ReturnType<typeof daemonResources>> | undefined;
	#fixture: HostFixture | undefined;
	#runtime: HostDaemon | undefined;
	#subscribed = Promise.withResolvers<void>();

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
			engine.#fixture = yield* hostFixture(engine.files, engine.config);
			for (const [workId, record] of Object.entries(engine.stored)) {
				yield* engine.store(workId, record);
			}
			engine.resources = yield* daemonResources(engine.fixture.parts.provider);
			engine.reads = snapshotReads(engine.fixture.host);
			yield* engine.start();
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
			const parts = { ...engine.fixture.parts, provider: resources.provider };
			if (engine.main !== undefined) {
				parts.main = movingMainSource(() => engine.observedMain);
			}
			engine.#subscribed = Promise.withResolvers<void>();
			engine.#runtime = yield* reads.observe(
				startHostDaemon(
					readDaemonLayer(engine.fixture.host, {
						onSnapshot: () => engine.#subscribed.resolve(),
						parts,
						port,
					}),
				),
			);
		});
	}

	stop() {
		const engine = this;
		return Effect.gen(function* () {
			yield* engine.running.stop;
			engine.#runtime = undefined;
		});
	}

	store(workId: string, record: Readonly<Record<string, unknown>>) {
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
