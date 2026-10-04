#!/usr/bin/env node
import process from "node:process";
import { Console, Effect } from "effect";
import { parseCommand, USAGE } from "./cli/args.ts";
import { writeBaseline } from "./cli/baseline.ts";
import { fix } from "./cli/fix.ts";
import { lint } from "./cli/lint.ts";
import { migrateBaseline } from "./cli/migrate.ts";
import { runMain } from "./cli/run-main.ts";
import { pruneBaseline, tightenBaseline } from "./cli/shrink.ts";
import { SetupFailure } from "./failure.ts";

const parsed = parseCommand(process.argv.slice(2));

const program = Effect.gen(function* () {
	if (parsed._tag === "Usage") {
		return yield* new SetupFailure({ message: `${parsed.problem}\n\n${USAGE}` });
	}
	const command = parsed.command;
	switch (command._tag) {
		case "Help":
			return yield* Console.log(USAGE);
		case "Lint":
			return yield* lint(process.cwd(), command.config, command.warnings);
		case "Fix":
			return yield* fix(process.cwd(), command.config);
		case "BaselineWrite":
			return yield* writeBaseline(process.cwd(), command.config, command.rules);
		case "BaselinePrune":
			return yield* pruneBaseline(process.cwd(), command.config, command.against);
		case "BaselineTighten":
			return yield* tightenBaseline(process.cwd(), command.config, command.staged);
		case "BaselineMigrate":
			return yield* migrateBaseline(process.cwd(), command.config, command.from);
	}
});

runMain(program);
