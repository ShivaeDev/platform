import { parseArgs } from "node:util";
import { Result } from "effect";
import type { WarningDetail } from "../report/render.ts";

export type Command =
	| { readonly _tag: "Lint"; readonly config: string | undefined; readonly warnings: WarningDetail }
	| { readonly _tag: "BaselineWrite"; readonly config: string | undefined; readonly rules: ReadonlyArray<string> }
	| { readonly _tag: "BaselinePrune"; readonly config: string | undefined }
	| { readonly _tag: "Help" };

export type Parsed = { readonly _tag: "Parsed"; readonly command: Command } | { readonly _tag: "Usage"; readonly problem: string };

export const USAGE = `Usage:
  quality lint [--config <file>] [--warnings summary|all]
  quality baseline write [--config <file>] [--rule <id>]...
  quality baseline prune [--config <file>]

lint            Run every rule. Exits 1 on an error-level violation, a baseline regression or a stale entry.
baseline write  Record current error-level violations. Creates the baseline, or adopts named rules into an existing one.
baseline prune  Drop fixed debt and lower entries to what is left. Never adds or raises an entry.

--config <file>  Config file; its directory is the repository root. Defaults to ./quality.config.ts.
Exit codes: 0 passed, 1 failed the gate, 2 could not run.`;

const OPTIONS = {
	config: { type: "string" },
	help: { short: "h", type: "boolean" },
	rule: { multiple: true, type: "string" },
	warnings: { type: "string" },
} as const;

const usage = (problem: string): Parsed => ({ _tag: "Usage", problem });

const parsed = (command: Command): Parsed => ({ _tag: "Parsed", command });

type Values = ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>["values"];

const lint = (values: Values): Parsed => {
	if (values.rule !== undefined) {
		return usage("--rule applies only to baseline write.");
	}
	const warnings = values.warnings ?? "summary";
	return warnings === "summary" || warnings === "all"
		? parsed({ _tag: "Lint", config: values.config, warnings })
		: usage(`--warnings takes summary or all, not "${warnings}".`);
};

const baseline = (action: string | undefined, values: Values): Parsed => {
	if (values.warnings !== undefined) {
		return usage("--warnings applies only to lint.");
	}
	if (action === "write") {
		return parsed({ _tag: "BaselineWrite", config: values.config, rules: values.rule ?? [] });
	}
	if (action === "prune" && values.rule === undefined) {
		return parsed({ _tag: "BaselinePrune", config: values.config });
	}
	return usage(action === "prune" ? "--rule applies only to baseline write." : "baseline takes write or prune.");
};

export const parseCommand = (args: ReadonlyArray<string>): Parsed => {
	const result = Result.try({
		catch: (error) => (error instanceof Error ? error.message : String(error)),
		try: () => parseArgs({ allowPositionals: true, args: [...args], options: OPTIONS, strict: true }),
	});
	if (Result.isFailure(result)) {
		return usage(result.failure);
	}
	const { positionals, values } = result.success;
	const [command = "lint", action, ...extra] = positionals;
	if (values.help === true || command === "help") {
		return parsed({ _tag: "Help" });
	}
	if (command === "lint" && action === undefined) {
		return lint(values);
	}
	if (command === "baseline" && extra.length === 0) {
		return baseline(action, values);
	}
	return usage(`unknown command: ${positionals.join(" ")}`);
};
