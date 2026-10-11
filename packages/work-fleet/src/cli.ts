#!/usr/bin/env node
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Argument from "effect/unstable/cli/Argument";
import * as CliError from "effect/unstable/cli/CliError";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";
import { board, config, host } from "#host/cliOptions.ts";
import { waitCommand, watchCommand } from "#host/followCommands.ts";

const runCommand = Command.make(
	"run",
	{ board: Argument.directory("board-dir"), config },
	Effect.fn("WorkFleetCli.run")(function* (input) {
		const { runFleet } = yield* Effect.promise(() => import("#host/commands.ts"));
		yield* runFleet(yield* host(input.board, input.config));
	}),
).pipe(Command.withDescription("Admit approved Board work, dispatch it and reconcile running work until interrupted"));

const dispatchCommand = Command.make(
	"dispatch",
	{ board, config, workId: Argument.string("id") },
	Effect.fn("WorkFleetCli.dispatch")(function* (input) {
		const { dispatchWork } = yield* Effect.promise(() => import("#host/commands.ts"));
		const { value } = yield* dispatchWork(yield* host(input.board, input.config), input.workId);
		yield* Console.log(`${value.workId} ${value.stage}${value.blocker === undefined ? "" : `: ${value.blocker}`}`);
	}),
).pipe(Command.withDescription("Prepare the current approved revision of one Board item and launch it"));

const statusCommand = Command.make(
	"status",
	{
		board,
		config,
		json: Flag.boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the views as JSON")),
		workId: Argument.string("id").pipe(Argument.optional),
	},
	Effect.fn("WorkFleetCli.status")(function* (input) {
		const [{ fleetStatus, renderStatus }, { readOnlySql }] = yield* Effect.promise(() =>
			Promise.all([import("#host/status.ts"), import("#host/readOnlySql.ts")]),
		);
		const settings = yield* host(input.board, input.config);
		const current = yield* fleetStatus(settings, Option.getOrUndefined(input.workId)).pipe(Effect.provide(readOnlySql(settings)));
		yield* Console.log(input.json ? JSON.stringify(current) : renderStatus(current));
	}),
).pipe(Command.withDescription("Show active, needs-human and completed Fleet work"));

const cli = Command.make("work-fleet").pipe(
	Command.withDescription("Run approved Work Board items through Work Fleet"),
	Command.withSubcommands([runCommand, dispatchCommand, statusCommand, waitCommand, watchCommand]),
);

const main = Command.run(cli, { version: "0.0.0" }).pipe(
	Effect.catch((error) =>
		(CliError.isCliError(error) ? Effect.void : Console.error(`work-fleet: ${error instanceof Error ? error.message : String(error)}`)).pipe(
			Effect.andThen(
				Effect.sync(() => {
					process.exitCode = 1;
				}),
			),
		),
	),
	Effect.provide(NodeServices.layer),
);

NodeRuntime.runMain(main);
