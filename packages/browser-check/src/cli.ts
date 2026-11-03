#!/usr/bin/env node
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Console, Effect, FileSystem, Option, Path, Schema } from "effect";
import { Command, Flag } from "effect/cli";
import { playwright } from "#adapters/playwright.ts";
import { check } from "#check.ts";

const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const manifestPath = yield* path.fromFileUrl(new URL("../package.json", import.meta.url));
	const manifest = yield* fs.readFileString(manifestPath);
	const { version } = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Struct({ version: Schema.String })))(manifest);
	const cli = Command.make(
		"browser-check",
		{
			pages: Flag.String("page").pipe(Flag.atLeast(0), Flag.withDescription("Page path to open and screenshot; repeat for more pages.")),
			text: Flag.String("text").pipe(Flag.atLeast(0), Flag.withDescription("Visible text required on each page; repeat for more checks.")),
			url: Flag.String("url").pipe(Flag.withDefault("http://127.0.0.1:5173")),
		},
		({ url, pages, text }) =>
			Effect.gen(function* () {
				const email = yield* Config.String("BROWSER_CHECK_EMAIL").pipe(Config.option);
				const credentials = Option.isSome(email) ? { email: email.value, password: yield* Config.String("BROWSER_CHECK_PASSWORD") } : undefined;
				yield* check({ pages: pages.length === 0 ? ["/"] : pages, text, url, ...(credentials === undefined ? {} : { credentials }) }).pipe(
					Effect.scoped,
				);
			}),
	).pipe(Command.withDescription("Opt-in local screenshots and smoke checks. Start your app first."));
	yield* Command.run(cli, { version });
});

program.pipe(
	Effect.provide(playwright),
	Effect.tapErrorTag("BrowserCheckError", (error) => Console.error(`browser-check: ${error.message}`)),
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain,
);
