#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Console, Effect, FileSystem, Schema } from "effect";
import { Argument, Command } from "effect/unstable/cli";
import { createApp } from "./createApp.ts";

const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const manifest = yield* fs.readFileString(fileURLToPath(new URL("../package.json", import.meta.url)));
	const { version } = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Struct({ version: Schema.String })))(manifest);
	const cli = Command.make("create-app", { folder: Argument.string("folder") }, ({ folder }) =>
		createApp(folder, fileURLToPath(new URL("../template.json", import.meta.url))),
	).pipe(Command.withDescription("Create and install a Platform application from the maintained starter."));
	yield* Command.run(cli, { version });
});

program.pipe(
	Effect.tapErrorTag("CreateAppError", (error) => Console.error(`create-app: ${error.message}`)),
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain,
);
