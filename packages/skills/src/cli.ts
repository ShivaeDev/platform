#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, Path } from "effect";
import { Command } from "effect/unstable/cli";
import { checkSkills } from "./checkSkills.ts";
import { readInstalled } from "./installed.ts";
import { AGENTS_SKILLS, BIN, CLAUDE_SKILLS, MANIFEST, PACKAGE, SELECTION_FIELD } from "./layout.ts";
import { syncSkills } from "./syncSkills.ts";

const program = Effect.gen(function* () {
	const path = yield* Path.Path;
	const installed = yield* readInstalled(yield* path.fromFileUrl(new URL("..", import.meta.url)));
	const repo = path.resolve();
	const sync = Command.make("sync", {}, () => syncSkills(repo, installed)).pipe(
		Command.withDescription(
			`Copy the skills listed in package.json "${SELECTION_FIELD}" into ${AGENTS_SKILLS}, link them from ${CLAUDE_SKILLS}, and record them in ${MANIFEST}.`,
		),
	);
	const check = Command.make("check", {}, () => checkSkills(repo, installed)).pipe(
		Command.withDescription(`Fail when the synced skills do not match the installed ${PACKAGE} and the selection in package.json.`),
	);
	const cli = Command.make(BIN).pipe(
		Command.withDescription(`Sync the shared agent skills of ${PACKAGE} into this repository.`),
		Command.withSubcommands([sync, check]),
	);
	yield* Command.run(cli, { version: installed.version });
});

program.pipe(
	Effect.tapErrorTag("SkillsError", (error) => Console.error(`${BIN}: ${error.message}`)),
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain,
);
