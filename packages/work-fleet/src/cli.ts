#!/usr/bin/env node
import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as CliError from "effect/cli/CliError";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { answerCommand, continueCommand, nameThreadsCommand, reassignCommand, releaseCommand } from "#host/actionCommands.ts";
import { board, config, host, port } from "#host/cliOptions.ts";
import { waitCommand, watchCommand } from "#host/followCommands.ts";
import { VERSION } from "#packageInfo.ts";

const serveCommand = Command.make(
	"serve",
	{ board: Argument.Directory("board-dir"), config, port },
	Effect.fn("WorkFleetCli.serve")(function* (input) {
		const { serveFleet } = yield* Effect.promise(() => import("#host/daemon.ts"));
		yield* serveFleet(yield* host(input.board, input.config), undefined, input.port);
	}),
).pipe(Command.withDescription("Serve the local Fleet HTTP RPC daemon and schedule approved Board work"));

const dispatchCommand = Command.make(
	"dispatch",
	{ board, config, port, workId: Argument.String("id") },
	Effect.fn("WorkFleetCli.dispatch")(function* (input) {
		const { daemonClient, daemonError } = yield* Effect.promise(() => import("#host/daemonClient.ts"));
		const value = yield* Effect.scoped(
			daemonClient(input.port).pipe(Effect.flatMap((client) => client("daemon.dispatch", { workId: input.workId }))),
		).pipe(Effect.mapError((error) => daemonError(error, input.port)));
		yield* Console.log(`${value.workId} ${value.stage}${value.blocker === undefined ? "" : `: ${value.blocker}`}`);
	}),
).pipe(Command.withDescription("Prepare the current approved revision of one Board item and launch it"));

const statusCommand = Command.make(
	"status",
	{
		board,
		config,
		json: Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the views as JSON")),
		port,
		workId: Argument.String("id").pipe(Argument.optional),
	},
	Effect.fn("WorkFleetCli.status")(function* (input) {
		const [{ daemonClient, daemonError }, { renderStatus }] = yield* Effect.promise(() =>
			Promise.all([import("#host/daemonClient.ts"), import("#host/renderStatus.ts")]),
		);
		const workId = Option.getOrUndefined(input.workId);
		const current = yield* Effect.scoped(
			daemonClient(input.port).pipe(Effect.flatMap((client) => client("daemon.status", workId === undefined ? {} : { workId }))),
		).pipe(Effect.mapError((error) => daemonError(error, input.port)));
		yield* Console.log(input.json ? JSON.stringify(current) : renderStatus(current, input.port));
	}),
).pipe(Command.withDescription("Show active and completed Fleet work, and waiting work grouped by owner"));

const cli = Command.make("work-fleet").pipe(
	Command.withDescription("Run approved Work Board items through Work Fleet"),
	Command.withSubcommands([
		serveCommand,
		dispatchCommand,
		continueCommand,
		releaseCommand,
		answerCommand,
		statusCommand,
		reassignCommand,
		waitCommand,
		watchCommand,
		nameThreadsCommand,
	]),
);

const main = Command.run(cli, { version: VERSION }).pipe(
	Effect.catchCauseIf(
		(cause) => !Cause.hasInterrupts(cause),
		(cause) => {
			const error = Cause.squash(cause);
			return (
				CliError.isCliError(error)
					? Effect.void
					: Console.error(`work-fleet: ${(error instanceof Error ? error.message : String(error)).replace(/[\r\n]+/gu, " ")}`)
			).pipe(
				Effect.andThen(
					Effect.sync(() => {
						process.exitCode = 1;
					}),
				),
			);
		},
	),
	Effect.provide(NodeServices.layer),
);

NodeRuntime.runMain(main);
