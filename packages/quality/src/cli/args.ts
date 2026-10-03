import { parseArgs } from "node:util";
import { Result } from "effect";
import type { WarningDetail } from "../report/render.ts";

export type Command =
	| { readonly _tag: "Lint"; readonly config: string | undefined; readonly warnings: WarningDetail }
	| { readonly _tag: "Fix"; readonly config: string | undefined }
	| { readonly _tag: "BaselineWrite"; readonly config: string | undefined; readonly rules: readonly string[] }
	| { readonly _tag: "BaselinePrune"; readonly config: string | undefined; readonly against: string | undefined }
	| { readonly _tag: "BaselineCheck"; readonly config: string | undefined; readonly against: string | undefined }
	| { readonly _tag: "BaselineTighten"; readonly config: string | undefined; readonly staged: boolean }
	| { readonly _tag: "BaselineMigrate"; readonly config: string | undefined; readonly from: string | undefined }
	| { readonly _tag: "Help" };

export type Parsed = { readonly _tag: "Parsed"; readonly command: Command } | { readonly _tag: "Usage"; readonly problem: string };

export const USAGE = `Usage:
  quality lint [--config <file>] [--warnings summary|all]
  quality fix [--config <file>]
  quality baseline write [--config <file>] [--rule <id>]...
  quality baseline prune [--config <file>] [--against <ref>]
  quality baseline tighten [--config <file>] [--staged]
  quality baseline check [--config <file>] [--against <ref>]
  quality baseline migrate [--config <file>] [--from <file>]

lint              Run every rule. Exits 1 on an error-level violation, a file over its baseline, a stale registry entry
                  or a baseline entry for a rule that is off or unknown.
fix               Apply Biome's safe fixes, assist actions and formatting.
baseline write    Record current error-level violations. Creates the baseline, or records the named rules again, replacing their entries.
baseline prune    Drop fixed debt, lower entries to what is left and carry entries to files git saw move. Never adds or raises an entry.
baseline tighten  Prune only the entries of files changed since HEAD, or with --staged, in the index.
baseline check    Compare the baseline with its version at the merge base. Exits 1 when it gained an entry or a higher count.
baseline migrate  Move a baseline from the earlier JSON format (--from, quality/baseline.json by default) to the configured file.

--config <file>  Config file; its directory is the repository root. Defaults to ./quality.config.ts.
--against <ref>  The branch the work merges into. Defaults to origin/HEAD, then origin/main, then origin/master.
Exit codes: 0 passed, 1 failed the gate, 2 could not run.`;

const OPTIONS = {
	against: { type: "string" },
	config: { type: "string" },
	from: { type: "string" },
	help: { short: "h", type: "boolean" },
	rule: { multiple: true, type: "string" },
	staged: { type: "boolean" },
	warnings: { type: "string" },
} as const;

const usage = (problem: string): Parsed => ({ _tag: "Usage", problem });

const parsed = (command: Command): Parsed => ({ _tag: "Parsed", command });

type Values = ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>["values"];

type Option = Exclude<keyof Values, "config" | "help">;

const COMMAND_OPTIONS: readonly Option[] = ["against", "from", "rule", "staged", "warnings"];

const ACCEPTS: Readonly<Record<string, readonly Option[]>> = {
	"baseline check": ["against"],
	"baseline migrate": ["from"],
	"baseline prune": ["against"],
	"baseline tighten": ["staged"],
	"baseline write": ["rule"],
	fix: [],
	lint: ["warnings"],
};

const misplaced = (name: string, values: Values): string | undefined => {
	const option = COMMAND_OPTIONS.find((key) => values[key] !== undefined && !(ACCEPTS[name] ?? []).includes(key));
	const owners = Object.keys(ACCEPTS).filter((owner) => option !== undefined && (ACCEPTS[owner] ?? []).includes(option));
	return option === undefined ? undefined : `--${option} applies only to ${owners.join(" and ")}.`;
};

const ref = (against: string | undefined, command: Command): Parsed =>
	against?.startsWith("-") === true ? usage(`--against takes a git ref, not "${against}".`) : parsed(command);

const commandFor = (name: string, values: Values): Parsed => {
	const config = values.config;
	switch (name) {
		case "lint": {
			const warnings = values.warnings ?? "summary";
			return warnings === "summary" || warnings === "all"
				? parsed({ _tag: "Lint", config, warnings })
				: usage(`--warnings takes summary or all, not "${warnings}".`);
		}
		case "fix":
			return parsed({ _tag: "Fix", config });
		case "baseline write":
			return parsed({ _tag: "BaselineWrite", config, rules: values.rule ?? [] });
		case "baseline prune":
			return ref(values.against, { _tag: "BaselinePrune", against: values.against, config });
		case "baseline check":
			return ref(values.against, { _tag: "BaselineCheck", against: values.against, config });
		case "baseline tighten":
			return parsed({ _tag: "BaselineTighten", config, staged: values.staged === true });
		default:
			return parsed({ _tag: "BaselineMigrate", config, from: values.from });
	}
};

export const parseCommand = (args: readonly string[]): Parsed => {
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
	const name = [command, ...rest].join(" ");
	if (ACCEPTS[name] === undefined) {
		return usage(command === "baseline" && rest.length < 2 ? "baseline takes write, prune, tighten, check or migrate." : `unknown command: ${name}`);
	}
	const problem = misplaced(name, values);
	return problem === undefined ? commandFor(name, values) : usage(problem);
};
