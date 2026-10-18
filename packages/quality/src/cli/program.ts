import { Console, Effect } from "effect";
import { parseCommand, USAGE } from "#cli/args.ts";
import { writeBaseline } from "#cli/baseline.ts";
import { fix } from "#cli/fix.ts";
import { lint } from "#cli/lint.ts";
import { migrateBaseline } from "#cli/migrate.ts";
import { migrateExceptions } from "#cli/migrateExceptions.ts";
import { pruneBaseline, tightenBaseline } from "#cli/shrink.ts";
import { SetupFailure } from "#failure.ts";
import type { Launch } from "#hooks/command.ts";
import { installHook } from "#hooks/install.ts";
import { preCommitHook } from "#hooks/preCommit.ts";
import { hookStatus } from "#hooks/status.ts";
import { uninstallHook } from "#hooks/uninstall.ts";

export interface Invocation {
	readonly cwd: string;
	readonly launch: Launch;
}

export const program = Effect.fn("Cli.program")(function* (args: readonly string[], { cwd, launch }: Invocation) {
	const parsed = parseCommand(args);
	if (parsed._tag === "Usage") {
		return yield* new SetupFailure({ message: `${parsed.problem}\n\n${USAGE}` });
	}
	const command = parsed.command;
	switch (command._tag) {
		case "Help":
			return yield* Console.log(USAGE);
		case "Lint":
			return yield* lint(cwd, command.config);
		case "Fix":
			return yield* fix(cwd, command.config);
		case "BaselineWrite":
			return yield* writeBaseline(cwd, command.config, command.rules);
		case "BaselinePrune":
			return yield* pruneBaseline(cwd, command.config, command.against);
		case "BaselineTighten":
			return yield* tightenBaseline(cwd, command.config, command.staged);
		case "ExceptionsMigrate":
			return yield* migrateExceptions(cwd, command.config, command.from);
		case "BaselineMigrate":
			return yield* migrateBaseline(cwd, command.config, command.from);
		case "HooksInstall":
			return yield* installHook({ config: command.config, cwd, force: command.force, launch });
		case "HooksUninstall":
			return yield* uninstallHook(cwd);
		case "HooksStatus":
			return yield* hookStatus(cwd);
		case "HooksPreCommit":
			return yield* preCommitHook(cwd, command.config);
	}
});
