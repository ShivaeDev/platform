import { Console, Effect } from "effect";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import { board, clientPort, config, port } from "#host/cliOptions.ts";
import { daemonRequest } from "#host/daemonClient.ts";

export const reservePrCommand = Command.make(
	"reserve-pr",
	{
		areas: Flag.String("areas").pipe(Flag.atLeast(0), Flag.withDescription("Area to reserve when no Board task matches; repeat for multiple areas")),
		board,
		config,
		port,
		pr: Argument.String("url"),
	},
	Effect.fn("WorkFleetCli.reservePr")(function* (input) {
		yield* daemonRequest(
			yield* clientPort(input),
			(client) => client("daemon.reserve-pr", { areas: input.areas, pr: input.pr }),
			`reserve ${input.pr}`,
		);
		yield* Console.log(`${input.pr}: reservation recorded`);
	}),
).pipe(Command.withDescription("Reserve a foreign PR's backlog and Board areas, or the supplied --areas"));
