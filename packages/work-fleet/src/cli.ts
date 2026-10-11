#!/usr/bin/env node
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect, Option } from "effect";
import { Argument, CliError, Command, Flag } from "effect/unstable/cli";
import { loadHost } from "#host/config.ts";

const board = Flag.directory("board").pipe(Flag.withDefault(".work"), Flag.withDescription("Board folder holding fleet.config.json"));
const config = Flag.file("config").pipe(Flag.optional, Flag.withDescription("Host configuration instead of <board>/fleet.config.json"));

function host(folder: string, file: Option.Option<string>) {
	return loadHost(folder, Option.getOrUndefined(file));
}

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

const continueCommand = Command.make(
	"continue",
	{ args: [Argument.string("id"), Argument.string("message").pipe(Argument.optional)] as const, board, config },
	Effect.fn("WorkFleetCli.continue")(function* (input) {
		const [{ continueWork }, { continuationMessage }] = yield* Effect.promise(() =>
			Promise.all([import("#host/commands.ts"), import("#host/continuationMessage.ts")]),
		);
		const message = yield* continuationMessage(Option.getOrUndefined(input.args[1]));
		const { value } = yield* continueWork(yield* host(input.board, input.config), input.args[0], message);
		yield* Console.log(`${value.workId} ${value.stage}${value.blocker === undefined ? "" : `: ${value.blocker}`}`);
	}),
).pipe(
	Command.withDescription("Continue terminal needs-human or completed work on its existing worker thread; read the message from stdin if omitted"),
);

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

// The orchestrator runs about a hundred waits at once, so wait loads neither the Fleet runtime nor a pooled client.
const waitCommand = Command.make(
	"wait",
	{
		board,
		config,
		interval: Flag.float("interval").pipe(Flag.withDefault(15), Flag.withDescription("Seconds between PostgreSQL reads")),
		timeout: Flag.float("timeout").pipe(Flag.optional, Flag.withDescription("Give up after this many seconds (exit 4)")),
		workId: Argument.string("id"),
	},
	Effect.fn("WorkFleetCli.wait")(function* (input) {
		const { waitFor } = yield* Effect.promise(() => import("#host/wait.ts"));
		const settings = yield* host(input.board, input.config);
		const outcome = yield* waitFor({
			databaseUrl: settings.databaseUrl,
			intervalMs: input.interval * 1000,
			namespace: settings.namespace,
			workId: input.workId,
			...Option.match(input.timeout, { onNone: () => ({}), onSome: (seconds) => ({ timeoutMs: seconds * 1000 }) }),
		});
		yield* Console.log(outcome.summary);
		process.exitCode = outcome.code;
	}),
).pipe(
	Command.withDescription(
		"Block until the work completes (exit 0), needs a human (2) or is released (3); 4 on --timeout, 1 on errors. Read-only against PostgreSQL",
	),
);

const cli = Command.make("work-fleet").pipe(
	Command.withDescription("Run approved Work Board items through Work Fleet"),
	Command.withSubcommands([runCommand, dispatchCommand, continueCommand, statusCommand, waitCommand]),
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
