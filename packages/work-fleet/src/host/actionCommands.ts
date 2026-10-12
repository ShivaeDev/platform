import { Console, Effect, Option } from "effect";
import * as Argument from "effect/unstable/cli/Argument";
import * as Command from "effect/unstable/cli/Command";
import { board, config, port } from "#host/cliOptions.ts";
import { continuationMessage } from "#host/continuationMessage.ts";
import { daemonRequest } from "#host/daemonClient.ts";

export const continueCommand = Command.make(
	"continue",
	{ args: [Argument.string("id"), Argument.string("message").pipe(Argument.optional)] as const, board, config, port },
	Effect.fn("WorkFleetCli.continue")(function* (input) {
		const message = yield* continuationMessage(Option.getOrUndefined(input.args[1]));
		const value = yield* daemonRequest(input.port, (client) => client("fleet.continue", { message, workId: input.args[0] }));
		yield* Console.log(`${value.workId} ${value.stage}${value.blocker === undefined ? "" : `: ${value.blocker}`}`);
	}),
).pipe(
	Command.withDescription("Continue terminal needs-human or completed work on its existing worker thread; read the message from stdin if omitted"),
);

export const releaseCommand = Command.make(
	"release",
	{ board, config, port, workIds: Argument.string("id").pipe(Argument.variadic({ min: 1 })) },
	Effect.fn("WorkFleetCli.release")(function* (input) {
		const released = yield* daemonRequest(input.port, (client) => client("daemon.release", { workIds: input.workIds }));
		for (const value of released) {
			yield* Console.log(`${value.workId} ${value.stage}${value.blocker === undefined ? "" : `: ${value.blocker}`}`);
		}
	}),
).pipe(Command.withDescription("Safely release terminal needs-human items and record their closing Board responses"));

export const reassignCommand = Command.make(
	"reassign",
	{
		board,
		config,
		id: Argument.string("id"),
		port,
		question: Argument.string("decision-id"),
		to: Argument.choice("owner", ["maintainer", "orchestrator", "automation"]),
	},
	Effect.fn("WorkFleetCli.reassign")(function* (input) {
		const value = yield* daemonRequest(input.port, (client) =>
			client("fleet.reassign", { attentionOwner: input.to, decisionId: input.question, workId: input.id }),
		);
		yield* Console.log(`${value.workId} ${value.stage} (waiting on ${value.attentionOwner})`);
	}),
).pipe(Command.withDescription("Reassign the exact waiting decision to its next actor"));

export const nameThreadsCommand = Command.make(
	"name-threads",
	{ board, config, port },
	Effect.fn("WorkFleetCli.nameThreads")(function* (input) {
		const results = yield* daemonRequest(input.port, (client) => client("daemon.name-threads", {}));
		for (const result of results) {
			yield* result.error ? Console.error(result.message) : Console.log(result.message);
		}
	}),
).pipe(Command.withDescription("Name existing Fleet Cloud threads after their Board work, best-effort"));

export const decideCommand = Command.make(
	"decide",
	{ args: [Argument.string("id"), Argument.choice("action", ["retry", "release"])] as const, board, config, port },
	Effect.fn("WorkFleetCli.decide")(function* (input) {
		const value = yield* daemonRequest(input.port, (client) => client("daemon.decide", { action: input.args[1], workId: input.args[0] }));
		yield* Console.log(`${value.workId} ${value.stage}${value.blocker === undefined ? "" : `: ${value.blocker}`}`);
	}),
).pipe(Command.withDescription("Answer the current published Fleet decision with retry or release"));
