import { parseArgs } from "node:util";
import { Result } from "effect";
import { SUBCOMMANDS } from "./messages.ts";
import { ACCEPTS, misplaced, OPTIONS, type Values } from "./options.ts";

export type Command =
	| { readonly _tag: "Ci"; readonly coverage: boolean }
	| { readonly _tag: "Setup"; readonly config: string | undefined }
	| { readonly _tag: "Lint"; readonly config: string | undefined }
	| { readonly _tag: "ExceptionsMigrate"; readonly config: string | undefined; readonly from: string | undefined }
	| { readonly _tag: "Fix"; readonly config: string | undefined; readonly rules: readonly string[] }
	| { readonly _tag: "BaselineMerge"; readonly base: string; readonly ours: string; readonly theirs: string }
	| { readonly _tag: "BaselineInstallDriver" }
	| {
			readonly _tag: "BaselineWrite";
			readonly config: string | undefined;
			readonly rules: readonly string[];
			readonly files: readonly string[];
			readonly firstAdoption: boolean;
	  }
	| { readonly _tag: "BaselinePrune"; readonly config: string | undefined; readonly against: string | undefined }
	| { readonly _tag: "BaselineTighten"; readonly config: string | undefined; readonly staged: boolean }
	| { readonly _tag: "BaselineMigrate"; readonly config: string | undefined; readonly from: string | undefined }
	| { readonly _tag: "HooksInstall"; readonly config: string | undefined; readonly force: boolean }
	| { readonly _tag: "HooksUninstall" }
	| { readonly _tag: "HooksStatus" }
	| { readonly _tag: "HooksPreCommit"; readonly config: string | undefined }
	| { readonly _tag: "Help" };

export type Parsed = { readonly _tag: "Parsed"; readonly command: Command } | { readonly _tag: "Usage"; readonly problem: string };

function usage(problem: string): Parsed {
	return { _tag: "Usage", problem };
}

function parsed(command: Command): Parsed {
	return { _tag: "Parsed", command };
}

function ref(against: string | undefined, command: Command): Parsed {
	return against?.startsWith("-") === true ? usage(`--against takes a git ref, not "${against}".`) : parsed(command);
}

function commandFor(name: string, values: Values): Parsed {
	const config = values.config;
	switch (name) {
		case "ci":
			return parsed({ _tag: "Ci", coverage: values.coverage === true });
		case "setup":
			return parsed({ _tag: "Setup", config });
		case "lint":
			return parsed({ _tag: "Lint", config });
		case "exceptions migrate":
			return parsed({ _tag: "ExceptionsMigrate", config, from: values.from });
		case "fix":
			return parsed({ _tag: "Fix", config, rules: values.rule ?? [] });
		case "baseline install-driver":
			return parsed({ _tag: "BaselineInstallDriver" });
		case "baseline write":
			return parsed({
				_tag: "BaselineWrite",
				config,
				files: values.file ?? [],
				firstAdoption: values["first-adoption"] === true,
				rules: values.rule ?? [],
			});
		case "baseline prune":
			return ref(values.against, { _tag: "BaselinePrune", against: values.against, config });
		case "baseline tighten":
			return parsed({ _tag: "BaselineTighten", config, staged: values.staged === true });
		case "hooks install":
			return parsed({ _tag: "HooksInstall", config, force: values.force === true });
		case "hooks uninstall":
			return parsed({ _tag: "HooksUninstall" });
		case "hooks status":
			return parsed({ _tag: "HooksStatus" });
		case "hooks pre-commit":
			return parsed({ _tag: "HooksPreCommit", config });
		default:
			return parsed({ _tag: "BaselineMigrate", config, from: values.from });
	}
}

export function parseCommand(args: readonly string[]): Parsed {
	const result = Result.try({
		catch: (error) => (error instanceof Error ? error.message : String(error)),
		try: () => parseArgs({ allowPositionals: true, args: [...args], options: OPTIONS, strict: true }),
	});
	if (Result.isFailure(result)) {
		return usage(result.failure);
	}
	const { positionals, values } = result.success;
	const [command = "lint", ...rest] = positionals;
	if (values.help === true || command === "help") {
		return parsed({ _tag: "Help" });
	}
	if (command === "baseline" && rest[0] === "merge") {
		const [, base, ours, theirs] = rest;
		return rest.length === 4 && base !== undefined && ours !== undefined && theirs !== undefined
			? parsed({ _tag: "BaselineMerge", base, ours, theirs })
			: usage("baseline merge takes <ancestor> <current> <other>.");
	}
	const name = [command, ...rest].join(" ");
	if (ACCEPTS[name] === undefined) {
		const subcommands = SUBCOMMANDS[command];
		return usage(subcommands !== undefined && rest.length < 2 ? subcommands : `unknown command: ${name}`);
	}
	const problem = misplaced(name, values);
	return problem === undefined ? commandFor(name, values) : usage(problem);
}
