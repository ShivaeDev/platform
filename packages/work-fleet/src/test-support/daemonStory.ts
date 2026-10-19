import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { FleetRecord } from "#model.ts";
import { discoveryDaemon } from "#test/discoveryDaemon.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { type HostFixture, hostFixture } from "#test/fleetHost.ts";
import { untilError, untilOutput } from "#test/follower.ts";
import { type Follower, followerProcess } from "#test/followerProcess.ts";
import { ownedFollower } from "#test/ownedFollower.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { statusRecord } from "#test/status.ts";
import { storeState } from "#test/storeState.ts";

interface DaemonEngine {
	daemon: Effect.Success<ReturnType<typeof discoveryDaemon>>;
	readonly fixture: HostFixture;
	follower?: Follower;
}

function follower(engine: DaemonEngine) {
	if (engine.follower === undefined) {
		throw new Error("Start a watch before reading its output");
	}
	return engine.follower;
}

export const fleetDaemon = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const fixture = yield* hostFixture();
		const engine: DaemonEngine = { daemon: yield* discoveryDaemon(fixture), fixture };
		return engine;
	},
	inspect: (engine) => ({ errors: engine.follower?.errors(), output: engine.follower?.output(), port: engine.daemon.port }),
	layer: postgresLayer,
	name: "Fleet daemon",
	runIf: postgresEnabled,
	stages: ["daemon"],
	verbs: (engine, story) => ({
		awaitError: (text: string, offset = 0) => untilError(follower(engine), text, offset),
		awaitOutput: (text: string) => untilOutput(follower(engine), text),
		awaitSnapshot: () =>
			Effect.promise(() =>
				Promise.race([
					engine.daemon.subscribed,
					follower(engine).done.then((result) => {
						throw new Error(`Follower exited before its snapshot: ${JSON.stringify(result)}`);
					}),
				]),
			).pipe(Effect.timeout("5 seconds")),
		client: (args: readonly [string, ...string[]]) =>
			Effect.promise(async () => {
				story.tell(`run ${args[0]} against the fixture Board`);
				let stderr = "";
				const result = await cliProcess([...args, "--board", engine.fixture.host.boardDir], {
					onError: (text) => {
						stderr += text;
					},
				});
				return { ...result, stderr };
			}),
		errors: () => follower(engine).errors(),
		exit: () => Effect.promise(() => follower(engine).done).pipe(Effect.timeout("5 seconds")),
		isRunning: () => follower(engine).isRunning(),
		output: () => follower(engine).output(),
		ownedWatchWithoutDiscovery: () => {
			story.tell("start a follower on its owned daemon without a discovery file");
			return ownedFollower(engine.fixture).pipe(
				Effect.tap((watch) =>
					Effect.sync(() => {
						engine.follower = watch;
					}),
				),
			);
		},
		port: () => engine.daemon.port,
		portFile: () =>
			Effect.sync(() => {
				const file = join(engine.fixture.host.boardDir, ".fleet-port");
				return existsSync(file) ? readFileSync(file, "utf8").trim() : undefined;
			}),
		replacePort: (port: number) =>
			Effect.sync(() => {
				story.tell(`replace the Board port file with ${port}`);
				engine.fixture.write(".fleet-port", `${port}\n`);
			}),
		restart: (port = 0) =>
			Effect.gen(function* () {
				story.tell(`restart the daemon on ${port === 0 ? "an allocated port" : `port ${port}`}`);
				const previousPort = engine.daemon.port;
				yield* engine.daemon.close.pipe(Effect.timeout("5 seconds"));
				story.tell("the old daemon stopped; start its replacement");
				engine.daemon = yield* discoveryDaemon(engine.fixture, port);
				story.tell("the replacement daemon is ready for a subscription");
				if (port === 0 && engine.daemon.port === previousPort) {
					return yield* Effect.die("Restart discovery stories require a different daemon port");
				}
			}),
		stop: () => {
			story.tell("stop the daemon");
			return engine.daemon.close.pipe(Effect.timeout("5 seconds"));
		},
		transition: (workId: string, stage: FleetRecord["stage"], decision?: FleetRecord["decision"]) => {
			story.tell(`${workId} enters ${stage}`);
			return storeState(engine.fixture.host, workId, { ...statusRecord(workId, stage), decision }).pipe(
				Effect.provideService(Reactivity.Reactivity, engine.daemon.reactivity),
			);
		},
		watch: (interval: number, options: { readonly ids?: readonly string[]; readonly port?: number; readonly timeout?: number } = {}) =>
			Effect.gen(function* () {
				const { port } = options;
				story.tell(`start watch --follow ${port === undefined ? "without --port" : `with --port ${port}`}`);
				engine.follower = yield* followerProcess(engine.fixture.configFile, "watch", options.ids ?? [], {
					follow: true,
					interval,
					...options,
				});
			}),
	}),
});

export function daemonPortIsUnreachable() {
	return fleetDaemon.trait("daemon", "the Board names an allocated and released daemon port", (engine) =>
		Effect.gen(function* () {
			yield* engine.daemon.close;
			engine.fixture.write(".fleet-port", `${engine.daemon.port}\n`);
		}),
	);
}

export function unreadablePortFile() {
	return fleetDaemon.trait("daemon", "the Board port file is an unreadable directory", (engine) =>
		Effect.gen(function* () {
			yield* engine.daemon.close;
			mkdirSync(join(engine.fixture.host.boardDir, ".fleet-port"));
		}),
	);
}
