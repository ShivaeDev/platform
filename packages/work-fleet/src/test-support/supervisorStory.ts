import { existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { processes } from "@shivaedev/work-board/server/integration/processes.ts";
import { boardSubscription } from "#test/boardSubscription.ts";
import { holdBoardRequest } from "#test/holdBoardRequest.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { SupervisorStoryEngine } from "#test/SupervisorStoryEngine.ts";
import { supervisorBoardCall } from "#test/supervisorBoardCall.ts";
import { supervisorSocketCall } from "#test/supervisorSocketCall.ts";

const layer = Layer.merge(postgresLayer, NodeServices.layer);

export const fleetSupervisor = storyKit({
	after: { installation: (engine: SupervisorStoryEngine) => engine.deploy() },
	around: withIsolatedDatabase,
	clock: "live",
	create: () => new SupervisorStoryEngine(),
	inspect: (engine) => engine.inspect(),
	layer,
	name: "Fleet supervision",
	runIf: postgresEnabled,
	stages: ["installation", "ownership"],
	verbs: (engine, story) => ({
		alive: processes.alive,
		awaitRevision: (previous: string) => engine.awaitRevision(previous),
		beginRequest: () => engine.beginRequest(),
		boardCli: (args: readonly string[]) => engine.run(args, engine.fixture.boardCli),
		boardDir: () => engine.fixture.boardDir,
		changeBoardCode: () =>
			Effect.sync(() => {
				story.tell("replace the installed Board server response");
				engine.fixture.changeBoardCode();
			}),
		changeCode: () =>
			Effect.sync(() => {
				story.tell("replace the installed daemon's live response");
				engine.fixture.changeCode();
			}),
		cli: (args: readonly string[]) => engine.run(args),
		crash: (pid: number) =>
			Effect.sync(() => {
				story.tell(`kill supervised pid ${pid}`);
				process.kill(pid, "SIGKILL");
			}),
		down: () => {
			story.tell("stop Fleet and Board with down");
			return engine.run(["down", engine.fixture.boardDir]);
		},
		exit: () => {
			const child = engine.process;
			if (child === undefined) {
				throw new Error("Start up first");
			}
			return child.done;
		},
		finishRequest: () => engine.finishRequest(),
		holdBoardRequest: () => {
			story.tell("a client leaves a Board socket request body unfinished");
			return holdBoardRequest(join(engine.fixture.boardDir, "board.sock"));
		},
		inbox: (port: number) => supervisorBoardCall(port, (client) => client("work-board.inbox", undefined)),
		lockExists: () => existsSync(join(engine.fixture.boardDir, ".work-up.json")),
		log: () => engine.log(),
		navigation: (port: number) => supervisorBoardCall(port, (client) => client("work-board.navigation", { current: "" })),
		preview: (port: number) =>
			supervisorBoardCall(port, (client) => client("work-board-responses.question", { item: "decision.operator", request: "direction" })),
		ready: (name: "daemon" | "board", previousPid?: number | null) => engine.ready(name, previousPid),
		register: (port: number, revision: string) =>
			supervisorBoardCall(port, (client) =>
				client("work-board-responses.registerQuestion", { item: "decision.operator", request: "direction", revision }),
			),
		request: (state: NonNullable<Effect.Success<ReturnType<typeof engine.state>>>, name: "daemon" | "board", path?: string) =>
			engine.http(state, name, path),
		running: () =>
			engine
				.state()
				.pipe(
					Effect.flatMap((state) =>
						state === undefined || state.daemon.pid === null || state.board.pid === null
							? Effect.die(new Error("Expected running children"))
							: Effect.succeed(state),
					),
				),
		runningPid: (name: "daemon" | "board") =>
			engine.state().pipe(
				Effect.flatMap((state) => {
					const pid = state?.[name].pid;
					return pid === undefined || pid === null ? Effect.die(new Error(`Expected a running ${name}`)) : Effect.succeed(pid);
				}),
			),
		serverInfo: (port: number) => supervisorBoardCall(port, (client) => client("work-board.server", undefined)),
		socketServerInfo: () => supervisorSocketCall(join(engine.fixture.boardDir, "board.sock")),
		stalePid: () => engine.stalePid,
		start: () => {
			story.tell("start Fleet and Board in a consumer repository");
			return engine.start();
		},
		state: () => engine.state(),
		subscribe: (port: number) => boardSubscription(port),
		upgrade: () =>
			Effect.sync(() => {
				story.tell("upgrade the installed Fleet package");
				engine.fixture.upgrade();
			}),
		waitForLog: (text: string) => engine.until(() => Effect.sync(() => engine.log().includes(text))),
	}),
});

export const staleSupervisor = fleetSupervisor.trait("ownership", "a dead supervisor left its lease", (engine) => engine.leaveStaleLock());
export const slowLiveRequest = fleetSupervisor.trait("installation", "the installed daemon has a slow live request", (engine) => {
	engine.delayedLive = true;
});

export function ignoresStop(name: "daemon" | "board") {
	return fleetSupervisor.trait("installation", `the ${name} ignores SIGTERM`, (engine) => {
		engine.stubbornChild = name;
	});
}
