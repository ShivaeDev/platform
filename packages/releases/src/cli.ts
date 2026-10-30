#!/usr/bin/env node
import process from "node:process";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Cause, Console, Effect, Option } from "effect";
import { Argument, CliError, Command, Flag } from "effect/cli";
import manifest from "@shivaedev/releases/package.json" with { type: "json" };
import { applyRelease } from "#applyRelease.ts";
import { checkRepository } from "#check.ts";
import { planRelease, summarizePlan } from "#planner.ts";
import { collectMigrationNotes } from "#releaseNotes.ts";
import { loadConfig } from "#workspace.ts";

const plan = Command.make(
	"plan",
	{ json: Flag.Boolean("json").pipe(Flag.withDefault(false)) },
	Effect.fn("Changesets.planCommand")(function* ({ json }) {
		const root = process.cwd();
		const result = yield* planRelease(root, yield* loadConfig(root));
		yield* Console.log(json ? JSON.stringify(result, null, 2) : summarizePlan(result));
	}),
);
const apply = Command.make(
	"apply",
	{},
	Effect.fn("Changesets.applyCommand")(function* () {
		const root = process.cwd();
		const result = yield* applyRelease(root, yield* loadConfig(root));
		if (result.releases.length > 0) {
			yield* Console.log(yield* collectMigrationNotes(result));
		}
		yield* Console.log(summarizePlan(result));
	}),
);
const check = Command.make(
	"check",
	{ base: Argument.String("base-ref").pipe(Argument.optional) },
	Effect.fn("Changesets.checkCommand")(function* ({ base }) {
		const root = process.cwd();
		yield* checkRepository(root, yield* loadConfig(root), Option.getOrUndefined(base));
		yield* Console.log("Changesets and release notes are valid.");
	}),
);

NodeRuntime.runMain(
	Command.make("releases").pipe(
		Command.withSubcommands([plan, apply, check]),
		Command.run({ version: manifest.version }),
		Effect.tapCause((cause) => {
			if (Cause.hasInterruptsOnly(cause)) {
				return Effect.void;
			}
			const error = Cause.squash(cause);
			if (CliError.isCliError(error)) {
				return Effect.void;
			}
			if (Cause.hasDies(cause)) {
				return Console.error(Cause.pretty(cause));
			}
			return Console.error(error instanceof Error ? error.message : String(error));
		}),
		Effect.provide(NodeServices.layer),
	),
	{ disableErrorReporting: true },
);
