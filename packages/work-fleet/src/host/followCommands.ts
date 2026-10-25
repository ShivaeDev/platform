import process from "node:process";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { board, config, port } from "#host/cliOptions.ts";
import { eventKinds } from "#host/watchEvents.ts";

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
			board: input.board,
			intervalMs: input.interval * 1000,
			...Option.match(input.port, {
				onNone: () => ({}),
				onSome: (value) => ({ port: value }),
			}),
			workId: input.workId,
			...Option.match(input.timeout, {
				onNone: () => ({}),
				onSome: (seconds) => ({ timeoutMs: seconds * 1000 }),
			}),
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
		events: Flag.String("events").pipe(Flag.optional, Flag.withDescription(`Comma-separated event kinds: ${eventKinds.join(", ")}`)),
		follow: Flag.Boolean("follow").pipe(Flag.withDefault(false), Flag.withDescription("Keep watching transitions, including newly launched work")),
		interval: Flag.Finite("interval").pipe(Flag.withDefault(0.5), Flag.withDescription("Seconds between daemon reconnect attempts")),
		port,
		stuckAfter: Flag.Finite("stuck-after").pipe(Flag.withDefault(1800), Flag.withDescription("Seconds without progress before a stuck event")),
		timeout: Flag.Finite("timeout").pipe(Flag.optional, Flag.withDescription("Give up after this many seconds (exit 4)")),
		workIds: Argument.String("id").pipe(Argument.variadic()),
	},
	Effect.fn("WorkFleetCli.watch")(function* (input) {
		if (Option.isSome(input.events) || (!input.follow && input.workIds.length === 0)) {
			const selected = Option.isSome(input.events) ? input.events.value.split(",").map((kind) => kind.trim()) : [...eventKinds];
			const unknown = selected.find((kind) => !eventKinds.some((known) => known === kind));
			if (unknown !== undefined) {
				return yield* Effect.fail(new Error(`Unknown event kind: ${unknown}; expected ${eventKinds.join(", ")}`));
			}
			const { watchStream } = yield* Effect.promise(() => import("#host/watchStream.ts"));
			process.exitCode = yield* watchStream({
				board: input.board,
				events: eventKinds.filter((kind) => selected.includes(kind)),
				intervalMs: input.interval * 1000,
				stuckMs: input.stuckAfter * 1000,
				workIds: input.workIds,
				...Option.match(input.port, {
					onNone: () => ({}),
					onSome: (value) => ({ port: value }),
				}),
				...Option.match(input.timeout, {
					onNone: () => ({}),
					onSome: (seconds) => ({ timeoutMs: seconds * 1000 }),
				}),
			});
			return;
		}
		const { watchFor } = yield* Effect.promise(() => import("#host/watch.ts"));
		process.exitCode = yield* watchFor({
			board: input.board,
			follow: input.follow,
			intervalMs: input.interval * 1000,
			...Option.match(input.port, {
				onNone: () => ({}),
				onSome: (value) => ({ port: value }),
			}),
			workIds: input.workIds,
			...Option.match(input.timeout, {
				onNone: () => ({}),
				onSome: (seconds) => ({ timeoutMs: seconds * 1000 }),
			}),
		});
	}),
).pipe(Command.withDescription("Stream JSON transitions and daemon health; IDs or --follow select text outcomes"));
