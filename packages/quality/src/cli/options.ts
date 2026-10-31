import type { parseArgs } from "node:util";

export const OPTIONS = {
	against: { type: "string" },
	config: { type: "string" },
	coverage: { type: "boolean" },
	file: { multiple: true, type: "string" },
	"first-adoption": { type: "boolean" },
	force: { type: "boolean" },
	from: { type: "string" },
	help: { short: "h", type: "boolean" },
	rule: { multiple: true, type: "string" },
	staged: { type: "boolean" },
} as const;

export type Values = ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>["values"];

type Option = Exclude<keyof Values, "config" | "help">;

const COMMAND_OPTIONS: readonly Option[] = ["against", "coverage", "file", "first-adoption", "force", "from", "rule", "staged"];

export const ACCEPTS: Readonly<Record<string, readonly Option[]>> = {
	"baseline install-driver": [],
	"baseline migrate": ["from"],
	"baseline prune": ["against"],
	"baseline tighten": ["staged"],
	"baseline write": ["rule", "file", "first-adoption"],
	ci: ["coverage"],
	"exceptions migrate": ["from"],
	fix: ["rule"],
	"hooks install": ["force"],
	"hooks pre-commit": [],
	"hooks status": [],
	"hooks uninstall": [],
	lint: [],
	setup: [],
};

export function misplaced(name: string, values: Values): string | undefined {
	const option = COMMAND_OPTIONS.find((key) => values[key] !== undefined && !(ACCEPTS[name] ?? []).includes(key));
	const owners = Object.keys(ACCEPTS).filter((owner) => option !== undefined && (ACCEPTS[owner] ?? []).includes(option));
	return option === undefined ? undefined : `--${option} applies only to ${owners.join(" and ")}.`;
}
