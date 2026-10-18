import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import type { FleetRecord } from "#model.ts";
import { discoveryDaemon } from "#test/discoveryDaemon.ts";
import { type HostFixture, hostFixture } from "#test/fleetHost.ts";
import { untilError, untilOutput } from "#test/follower.ts";
import { type Follower, followerProcess } from "#test/followerProcess.ts";
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
		awaitError: (text: string) => untilError(follower(engine), text),
		awaitOutput: (text: string) => untilOutput(follower(engine), text),
		awaitSnapshot: () => Effect.promise(() => engine.daemon.subscribed).pipe(Effect.timeout("5 seconds")),
		errors: () => follower(engine).errors(),
		exit: () => Effect.promise(() => follower(engine).done).pipe(Effect.timeout("5 seconds")),
		isRunning: () => follower(engine).isRunning(),
		output: () => follower(engine).output(),
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
		restart: () =>
			Effect.gen(function* () {
				story.tell("restart the daemon on an allocated port");
				const previousPort = engine.daemon.port;
				yield* engine.daemon.close;
				engine.daemon = yield* discoveryDaemon(engine.fixture);
				if (engine.daemon.port === previousPort) {
					return yield* Effect.die("Restart discovery stories require a different daemon port");
				}
			}),
		stop: () => {
			story.tell("stop the daemon");
			return engine.daemon.close;
		},
		transition: (workId: string, stage: FleetRecord["stage"], decision?: FleetRecord["decision"]) => {
			story.tell(`${workId} enters ${stage}`);
			return storeState(engine.fixture.host, workId, { ...statusRecord(workId, stage), decision }).pipe(
				Effect.provideService(Reactivity.Reactivity, engine.daemon.reactivity),
			);
		},
		watch: (interval: number, port?: number) =>
			Effect.gen(function* () {
				story.tell(`start watch --follow ${port === undefined ? "without --port" : `with --port ${port}`}`);
				engine.follower = yield* followerProcess(engine.fixture.configFile, "watch", [], {
					follow: true,
					interval,
					...(port === undefined ? {} : { port }),
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
