#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Runtime, Schema } from "effect";
import { Argument, Command } from "effect/cli";
import { program } from "#cli/program.ts";

let commandExitCode: number | undefined;

const main = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const manifest = yield* fs.readFileString(fileURLToPath(new URL("../package.json", import.meta.url)));
	const { version } = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Struct({ version: Schema.String })))(manifest);
	const cli = Command.make(
		"heavy-lock",
		{ command: Argument.String("command"), rest: Argument.String("args").pipe(Argument.variadic()) },
		({ command, rest }) =>
			program([command, ...rest]).pipe(
				Effect.tap((code) =>
					Effect.sync(() => {
						commandExitCode = code;
					}),
				),
				// Let signal forwarding finish before the runtime's interruption ends the main fiber.
				Effect.uninterruptible,
			),
	).pipe(Command.withDescription("Run a heavy command under the machine-wide lock. Use -- before the command to preserve its flags."));
	yield* Command.run(cli, { version });
});

NodeRuntime.runMain(main.pipe(Effect.provide(NodeServices.layer)), {
	teardown: (exit, onExit) => (commandExitCode === undefined ? Runtime.defaultTeardown(exit, onExit) : onExit(commandExitCode)),
});
