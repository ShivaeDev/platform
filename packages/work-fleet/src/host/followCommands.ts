import process from "node:process";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { board, config, port } from "#host/cliOptions.ts";

export const waitCommand = Command.make(
	"wait",
	{
		board,
		config,
		interval: Flag.Finite("interval").pipe(Flag.withDefault(15), Flag.withDescription("Seconds between daemon reconnect attempts")),
		port,
		timeout: Flag.Finite("timeout").pipe(Flag.optional, Flag.withDescription("Give up after this many seconds (exit 4)")),
		workId: Argument.String("id"),
	},
	Effect.fn("WorkFleetCli.wait")(function* (input) {
		const { waitFor } = yield* Effect.promise(() => import("#host/wait.ts"));
		const outcome = yield* waitFor({
			intervalMs: input.interval * 1000,
			port: input.port,
			workId: input.workId,
			...Option.match(input.timeout, { onNone: () => ({}), onSome: (seconds) => ({ timeoutMs: seconds * 1000 }) }),
		});
		yield* Console.log(outcome.summary);
		process.exitCode = outcome.code;
	}),
).pipe(Command.withDescription("Block until the work completes (exit 0), needs a human (2) or is released (3); 4 on --timeout, 1 on errors"));

export const watchCommand = Command.make(
	"watch",
	{
		board,
		config,
		follow: Flag.Boolean("follow").pipe(Flag.withDefault(false), Flag.withDescription("Keep watching transitions, including newly launched work")),
		interval: Flag.Finite("interval").pipe(Flag.withDefault(15), Flag.withDescription("Seconds between daemon reconnect attempts")),
		port,
		timeout: Flag.Finite("timeout").pipe(Flag.optional, Flag.withDescription("Give up after this many seconds (exit 4)")),
		workIds: Argument.String("id").pipe(Argument.variadic()),
	},
	Effect.fn("WorkFleetCli.watch")(function* (input) {
		const { watchFor } = yield* Effect.promise(() => import("#host/watch.ts"));
		process.exitCode = yield* watchFor({
			follow: input.follow,
			intervalMs: input.interval * 1000,
			port: input.port,
			workIds: input.workIds,
			...Option.match(input.timeout, { onNone: () => ({}), onSome: (seconds) => ({ timeoutMs: seconds * 1000 }) }),
		});
	}),
).pipe(Command.withDescription("Print item outcomes; --follow keeps watching transitions and new work until interrupted"));
