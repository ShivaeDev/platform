import { Console, Effect } from "effect";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import { board, clientPort, port } from "#host/cliOptions.ts";
import { daemonRequest } from "#host/daemonClient.ts";

export const closeFinishedDecisionsCommand = Command.make(
	"close-finished-decisions",
	{ board, dryRun: Flag.Boolean("dry-run").pipe(Flag.withDefault(false)), port },
	Effect.fn("WorkFleetCli.closeFinishedDecisions")(function* (input) {
		const closed = yield* daemonRequest(
			yield* clientPort(input),
			(client) => client("daemon.close-finished-decisions", { dryRun: input.dryRun }),
			"close-finished-decisions",
			120_000,
		);
		for (const decision of closed) {
			yield* Console.log(`${input.dryRun ? "Would close" : "Closed"} ${decision.sourcePath}: ${decision.reason}`);
		}
		yield* Console.log(`${closed.length} decision(s) ${input.dryRun ? "would close" : "closed"}.`);
	}),
).pipe(
	Command.withDescription(
		"Close applied decisions and stale failed answers for finished work, or unanswered decisions for done, deferred or dropped Board work",
	),
);
