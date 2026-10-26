import { Clock, Console, Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { config, host } from "./cliOptions.ts";
import { DAEMON_PORT } from "./daemon.ts";
import { stopSupervision, supervise } from "./supervisor.ts";
import { renderSupervision, supervisionStatus } from "./supervisorState.ts";

export const upCommand = Command.make(
	"up",
	{
		board: Argument.Directory("board-dir").pipe(Argument.withDefault(".work")),
		boardPort: Flag.Int("board-port").pipe(Flag.withDefault(4747), Flag.withDescription("Work Board HTTP port")),
		config,
		home: Flag.String("home").pipe(Flag.optional, Flag.withDescription("Board home file, relative to the board directory")),
		json: Flag.Boolean("json").pipe(Flag.withDefault(false)),
		maintainer: Flag.String("maintainer").pipe(Flag.withDefault("maintainer")),
		port: Flag.Int("port").pipe(Flag.withAlias("fleet-port"), Flag.withDefault(DAEMON_PORT), Flag.withDescription("Fleet daemon HTTP port")),
		responses: Flag.Boolean("responses").pipe(Flag.withDefault(false)),
		status: Flag.Boolean("status").pipe(Flag.withDefault(false), Flag.withDescription("Show the running supervisor, processes and log path")),
	},
	Effect.fn("WorkFleetCli.up")(function* (input) {
		if (input.status) {
			const state = yield* supervisionStatus(input.board);
			const text = state === undefined ? "Fleet up is not running for this board" : renderSupervision(state, yield* Clock.currentTimeMillis);
			return yield* Console.log(input.json ? JSON.stringify(state ?? null) : text);
		}
		yield* host(input.board, input.config);
		yield* supervise({
			boardDir: input.board,
			boardPort: input.boardPort,
			config: Option.getOrUndefined(input.config),
			daemonPort: input.port,
			home: Option.getOrUndefined(input.home),
			maintainer: input.maintainer,
			responses: input.responses,
		});
	}),
).pipe(Command.withDescription("Supervise Fleet and Work Board together, restarting exited or changed code"));

export const downCommand = Command.make(
	"down",
	{
		board: Argument.Directory("board-dir"),
	},
	({ board }) => stopSupervision(board),
).pipe(Command.withDescription("Stop the Fleet supervisor and both of its processes cleanly"));
