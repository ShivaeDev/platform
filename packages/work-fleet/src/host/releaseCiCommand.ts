import { Console, Effect } from "effect";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import { board, clientPort, config, port } from "#host/cliOptions.ts";
import { daemonRequest } from "#host/daemonClient.ts";
import { workSummary } from "#host/workSummary.ts";

export const releaseCiCommand = Command.make(
	"release-ci",
	{ args: [Argument.String("id"), Argument.String("head")] as const, board, config, port },
	Effect.fn("WorkFleetCli.releaseCi")(function* (input) {
		const value = yield* daemonRequest(
			yield* clientPort(input),
			(client) => client("fleet.release-ci", { head: input.args[1], workId: input.args[0] }),
			`release-ci ${input.args[0]}`,
		);
		yield* Console.log(workSummary(value));
	}),
).pipe(Command.withDescription("Release the CI-change hold for one exact PR head"));
