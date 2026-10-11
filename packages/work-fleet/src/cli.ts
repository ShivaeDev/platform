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
import { board, config, host, port } from "#host/cliOptions.ts";
import { waitCommand, watchCommand } from "#host/followCommands.ts";

const serveCommand = Command.make(
	"serve",
	{ board: Argument.directory("board-dir"), config, port },
	Effect.fn("WorkFleetCli.serve")(function* (input) {
		const { serveFleet } = yield* Effect.promise(() => import("#host/daemon.ts"));
		yield* serveFleet(yield* host(input.board, input.config), undefined, input.port);
	}),
).pipe(Command.withDescription("Serve the local Fleet HTTP RPC daemon and schedule approved Board work"));

const dispatchCommand = Command.make(
	"dispatch",
	{ board, config, port, workId: Argument.string("id") },
	Effect.fn("WorkFleetCli.dispatch")(function* (input) {
		const { daemonClient, daemonError } = yield* Effect.promise(() => import("#host/daemonClient.ts"));
		const value = yield* Effect.scoped(
			daemonClient(input.port).pipe(Effect.flatMap((client) => client("daemon.dispatch", { workId: input.workId }))),
		).pipe(Effect.mapError((error) => daemonError(error, input.port)));
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

const releaseCommand = Command.make(
	"release",
	{ board, config, workIds: Argument.string("id").pipe(Argument.variadic({ min: 1 })) },
	Effect.fn("WorkFleetCli.release")(function* (input) {
		const { releaseWork } = yield* Effect.promise(() => import("#host/releaseWork.ts"));
		const released = yield* releaseWork(yield* host(input.board, input.config), input.workIds);
		for (const { value } of released) {
			yield* Console.log(`${value.workId} ${value.stage}${value.blocker === undefined ? "" : `: ${value.blocker}`}`);
		}
	}),
).pipe(Command.withDescription("Safely release terminal needs-human items and record their closing Board responses"));

const statusCommand = Command.make(
	"status",
	{
		board,
		config,
		json: Flag.boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Print the views as JSON")),
		port,
		workId: Argument.string("id").pipe(Argument.optional),
	},
	Effect.fn("WorkFleetCli.status")(function* (input) {
		const [{ daemonClient, daemonError }, { renderStatus }] = yield* Effect.promise(() =>
			Promise.all([import("#host/daemonClient.ts"), import("#host/renderStatus.ts")]),
		);
		const workId = Option.getOrUndefined(input.workId);
		const current = yield* Effect.scoped(
			daemonClient(input.port).pipe(Effect.flatMap((client) => client("daemon.status", workId === undefined ? {} : { workId }))),
		).pipe(Effect.mapError((error) => daemonError(error, input.port)));
		yield* Console.log(input.json ? JSON.stringify(current) : renderStatus(current));
	}),
).pipe(Command.withDescription("Show active and completed Fleet work, and waiting work grouped by owner"));

const reassignCommand = Command.make(
	"reassign",
	{
		board,
		config,
		id: Argument.string("id"),
		question: Argument.string("decision-id"),
		to: Argument.choice("owner", ["maintainer", "orchestrator", "automation"]),
	},
	Effect.fn("WorkFleetCli.reassign")(function* (input) {
		const { reassignWork } = yield* Effect.promise(() => import("#host/reassignWork.ts"));
		const { value } = yield* reassignWork(yield* host(input.board, input.config), input.id, input.question, input.to);
		yield* Console.log(`${value.workId} ${value.stage} (waiting on ${value.attentionOwner})`);
	}),
).pipe(Command.withDescription("Reassign the exact waiting decision to its next actor"));

const nameThreadsCommand = Command.make(
	"name-threads",
	{ board, config },
	Effect.fn("WorkFleetCli.nameThreads")(function* (input) {
		const { nameThreads } = yield* Effect.promise(() => import("#host/nameThreads.ts"));
		yield* nameThreads(yield* host(input.board, input.config));
	}),
).pipe(Command.withDescription("Name existing Fleet Cloud threads after their Board work, best-effort"));

const cli = Command.make("work-fleet").pipe(
	Command.withDescription("Run approved Work Board items through Work Fleet"),
	Command.withSubcommands([
		serveCommand,
		dispatchCommand,
		continueCommand,
		releaseCommand,
		statusCommand,
		reassignCommand,
		waitCommand,
		watchCommand,
		nameThreadsCommand,
	]),
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
