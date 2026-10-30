#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Cause, Console, Effect, Logger, Stdio, Stream } from "effect";
import { CliError, Command } from "effect/cli";
import { GitHubTokenError } from "@shivaedev/github/errors.ts";
import { WatchError } from "#model.ts";
import packageInfo from "#package.json" with { type: "json" };
import { watchCommand } from "#program.ts";
import { requestFailure } from "#requestFailure.ts";
import { watcherLayer } from "#watcherLayer.ts";

const main = Effect.gen(function* () {
	const stdio = yield* Stdio.Stdio;
	function emit(line: string) {
		return Stream.make(`${line}\n`).pipe(
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
	yield* Command.run(watchCommand(emit, diagnostic).pipe(Command.provide(watcherLayer)), { version: packageInfo.version });
}).pipe(
	Effect.tapError((error) =>
		CliError.isCliError(error) ? Effect.void : Console.error(error instanceof GitHubTokenError ? error.message : requestFailure(error).message),
	),
	Effect.tapCause((cause) => (Cause.hasDies(cause) ? Console.error(Cause.pretty(cause)) : Effect.void)),
	Effect.provide(NodeServices.layer),
	Effect.provide(Logger.layer([])),
);

NodeRuntime.runMain(main, { disableErrorReporting: true });
