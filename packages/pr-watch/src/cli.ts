#!/usr/bin/env node
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Cause, Console, Effect, Logger, Stdio, Stream } from "effect";
import { CliError, Command } from "effect/cli";
import { GitHubTokenError } from "@shivaedev/github/errors.ts";
import { WatchError } from "#model.ts";
import { encodeJsonLine, type WatchEvent } from "#outputEvent.ts";
import packageInfo from "#package.json" with { type: "json" };
import { watchCommand } from "#program.ts";
import { requestFailure } from "#requestFailure.ts";
import { waitCommand } from "#waitCommand.ts";
import { encodeWaitResult, WaitEnded, type WaitResult } from "#waitResult.ts";
import { watcherLayer } from "#watcherLayer.ts";

const main = Effect.gen(function* () {
	const stdio = yield* Stdio.Stdio;
	function print(line: string) {
		return Stream.make(line).pipe(
			Stream.run(stdio.stdout({ endOnDone: false })),
			Effect.mapError((cause) => new WatchError({ message: "Output stream failed", reason: "output" }, { cause })),
		);
	}
	function diagnostic(line: string) {
		return Stream.make(`${line}\n`).pipe(
			Stream.run(stdio.stderr({ endOnDone: false })),
			Effect.mapError((cause) => new WatchError({ message: "Output stream failed", reason: "output" }, { cause })),
		);
	}
	const wait = waitCommand((result: WaitResult) => print(encodeWaitResult(result)), diagnostic).pipe(Command.provide(watcherLayer));
	const watch = watchCommand((event: WatchEvent) => print(encodeJsonLine(event)), diagnostic).pipe(Command.provide(watcherLayer));
	yield* Command.run(watch.pipe(Command.withSubcommands([wait])), { version: packageInfo.version });
}).pipe(
	Effect.tapError((error) =>
		CliError.isCliError(error) || error instanceof WaitEnded
			? Effect.void
			: Console.error(error instanceof GitHubTokenError ? error.message : requestFailure(error).message),
	),
	Effect.tapCause((cause) => (Cause.hasDies(cause) ? Console.error(Cause.pretty(cause)) : Effect.void)),
	Effect.provide(NodeServices.layer),
	Effect.provide(Logger.layer([])),
);

NodeRuntime.runMain(main, { disableErrorReporting: true });
