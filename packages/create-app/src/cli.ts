#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Cause, Console, Effect, FileSystem, Option, Schema } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { addResource } from "./addResource.ts";
import { CreateAppError } from "./CreateAppError.ts";
import { createApp } from "./createApp.ts";
import { updateApp } from "./updateApp.ts";

const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const manifest = yield* fs.readFileString(fileURLToPath(new URL("../package.json", import.meta.url)));
	const { version } = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Struct({ version: Schema.String })))(manifest);
	const templatePath = fileURLToPath(new URL("../template.json", import.meta.url));
	const update = Command.make("update", {}, () => updateApp(".", templatePath, version));
	const resource = Command.make("resource", { name: Argument.String("name") }, ({ name }) => addResource(".", name)).pipe(
		Command.withDescription("Add an authenticated resource and register it in this app's server module list."),
	);
	const cli = Command.make(
		"create-app",
		{
			folder: Argument.String("folder").pipe(Argument.optional),
			git: Flag.Boolean("git").pipe(Flag.withDefault(true)),
			minimal: Flag.Boolean("minimal").pipe(Flag.withDefault(false), Flag.withDescription("Create the starter without the notes example module.")),
		},
		({ folder, git, minimal }) =>
			Option.match(folder, {
				onNone: () => Effect.fail(new CreateAppError({ message: "Provide an app folder or use create-app update or resource." })),
				onSome: (destination) => createApp(destination, templatePath, { git, minimal, version }),
			}),
	).pipe(
		Command.withSubcommands([update, resource]),
		Command.withDescription("Create and install a Platform application from the maintained starter."),
	);
	yield* Command.run(cli, { version });
});

program.pipe(
	Effect.tapCause((cause) => {
		const error = Cause.squash(cause);
		return Console.error(error instanceof CreateAppError && error.cause === undefined ? `create-app: ${error.message}` : Cause.pretty(cause));
	}),
	Effect.provide([NodeServices.layer, NodeCrypto.layerSecureRandom]),
	NodeRuntime.runMain({ disableErrorReporting: true }),
);
