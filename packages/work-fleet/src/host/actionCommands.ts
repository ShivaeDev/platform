import { Console, Effect, Option } from "effect";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import { answerText } from "#host/answerText.ts";
import { board, clientPort, config, port } from "#host/cliOptions.ts";
import { continuationMessage } from "#host/continuationMessage.ts";
import { daemonRequest } from "#host/daemonClient.ts";

export const continueCommand = Command.make(
	"continue",
	{ args: [Argument.String("id"), Argument.String("message").pipe(Argument.optional)] as const, board, config, port },
	Effect.fn("WorkFleetCli.continue")(function* (input) {
		const message = yield* continuationMessage(Option.getOrUndefined(input.args[1]));
		const value = yield* daemonRequest(
			yield* clientPort(input),
			(client) => client("fleet.continue", { message, workId: input.args[0] }),
			`continue ${input.args[0]}`,
		);
		yield* Console.log(`${value.workId} ${value.stage}${value.blocker === undefined ? "" : `: ${value.blocker}`}`);
	}),
).pipe(
	Command.withDescription("Continue terminal needs-human or completed work on its existing worker thread; read the message from stdin if omitted"),
);

export const releaseCommand = Command.make(
	"release",
	{ board, config, port, workIds: Argument.String("id").pipe(Argument.variadic({ min: 1 })) },
	Effect.fn("WorkFleetCli.release")(function* (input) {
		const released = yield* daemonRequest(
			yield* clientPort(input),
			(client) => client("daemon.release", { workIds: input.workIds }),
			`release ${input.workIds.join(", ")}`,
		);
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
		id: Argument.String("id"),
		port,
		question: Argument.String("decision-id"),
		to: Argument.Literals("owner", ["maintainer", "orchestrator", "automation"]),
	},
	Effect.fn("WorkFleetCli.reassign")(function* (input) {
		const value = yield* daemonRequest(
			yield* clientPort(input),
			(client) => client("fleet.reassign", { attentionOwner: input.to, decisionId: input.question, workId: input.id }),
			`reassign ${input.id}`,
		);
		yield* Console.log(`${value.workId} ${value.stage} (waiting on ${value.attentionOwner})`);
	}),
).pipe(Command.withDescription("Reassign the exact waiting decision to its next actor"));

export const nameThreadsCommand = Command.make(
	"name-threads",
	{ board, config, port },
	Effect.fn("WorkFleetCli.nameThreads")(function* (input) {
		const results = yield* daemonRequest(yield* clientPort(input), (client) => client("daemon.name-threads", {}), "name-threads");
		for (const result of results) {
			yield* result.error ? Console.error(result.message) : Console.log(result.message);
		}
	}),
).pipe(Command.withDescription("Name existing Fleet Cloud threads after their Board work, best-effort"));

export const answerCommand = Command.make(
	"answer",
	{
		args: [Argument.String("id"), Argument.String("text").pipe(Argument.optional)] as const,
		board,
		config,
		port,
		release: Flag.Boolean("release").pipe(Flag.withDefault(false)),
	},
	Effect.fn("WorkFleetCli.answer")(function* (input) {
		const supplied = Option.getOrUndefined(input.args[1]);
		const text = input.release && supplied === undefined ? "" : yield* answerText(supplied);
		const value = yield* daemonRequest(
			yield* clientPort(input),
			(client) => client("daemon.answer", { release: input.release, text, workId: input.args[0] }),
			`answer ${input.args[0]}`,
		);
		yield* Console.log(`${value.workId} ${value.stage}${value.blocker === undefined ? "" : `: ${value.blocker}`}`);
	}),
).pipe(Command.withDescription("Answer the waiting worker question or Fleet decision; read text from stdin if omitted, or use --release"));
