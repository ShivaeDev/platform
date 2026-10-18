import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { discoveryDaemon } from "#test/discoveryDaemon.ts";
import { type HostFixture, hostFixture } from "#test/fleetHost.ts";
import { untilError, untilOutput } from "#test/follower.ts";
import { type Follower, followerProcess } from "#test/followerProcess.ts";
import { postgresAvailable, postgresLayer } from "#test/postgres.ts";
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
	runIf: postgresAvailable,
	stages: ["daemon"],
	verbs: (engine, story) => ({
		awaitError: (text: string) => untilError(follower(engine), text),
		awaitOutput: (text: string) => untilOutput(follower(engine), text),
		awaitSnapshot: () => Effect.promise(() => engine.daemon.subscribed).pipe(Effect.timeout("5 seconds")),
		errors: () => follower(engine).errors(),
		isRunning: () => follower(engine).isRunning(),
		output: () => follower(engine).output(),
		port: () => engine.daemon.port,
		restart: () =>
			Effect.gen(function* () {
				story.tell("restart the daemon on an allocated port");
				engine.daemon = yield* discoveryDaemon(engine.fixture);
			}),
		transition: (workId: string, stage: "completed" | "released") => {
			story.tell(`${workId} enters ${stage}`);
			return storeState(engine.fixture.host, workId, { stage }).pipe(Effect.provideService(Reactivity.Reactivity, engine.daemon.reactivity));
		},
		watch: () =>
			Effect.gen(function* () {
				story.tell("start watch --follow without --port");
				engine.follower = yield* followerProcess(engine.fixture.configFile, "watch", [], { follow: true, interval: 0.05 });
			}),
	}),
});

export function daemonIsStopped() {
	return fleetDaemon.trait("daemon", "the daemon has stopped", (engine) => engine.daemon.close);
}
