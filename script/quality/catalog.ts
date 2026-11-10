import { Effect } from "effect";
import { FilesystemFailure } from "@shivaedev/quality/inventory/filesystem.ts";
import type { Finding, RuleInputs } from "@shivaedev/quality/rule.ts";

const WORKSPACE = "pnpm-workspace.yaml";
const HEADING = /^(?<quote>["']?)(?<key>catalog|catalogs|overrides)\k<quote>\s*:(?<rest>.*)$/u;
const SECTION_END = /^[^\s#]/u;
const ENTRY = /^\s+(?=[^\s#])(?<quote>["']?)(?<name>[^"':]+)\k<quote>\s*:\s*(?<value>\S.*)$/u;
const NAMED_CATALOG = /^\s+(?<quote>["']?)(?<name>[^"':\s#]+)\k<quote>\s*:\s*(?:#.*)?$/u;

interface Entry {
	readonly catalog: string;
	readonly line: number;
	readonly name: string;
	readonly section: "catalog" | "overrides";
	readonly value: string;
}

function inlineHeading(line: number, key: string, rest: string): readonly Finding[] {
	if (rest.replace(/#.*$/u, "").trim() === "") {
		return [];
	}
	return [
		{
			file: "pnpm-workspace.yaml",
			line,
			message: `"${key}" holds an inline value. Write it as an indented block mapping so every entry is checked.`,
		},
	];
}

interface ScanState {
	readonly catalogName: string;
	readonly named: boolean;
	readonly section: Entry["section"] | undefined;
}

function headingState(key: string): ScanState {
	return { catalogName: key === "catalog" ? "default" : "", named: key === "catalogs", section: key === "overrides" ? "overrides" : "catalog" };
}

function lineState(state: ScanState, text: string): ScanState {
	if (SECTION_END.test(text)) {
		return { ...state, section: undefined };
	}
	const named = state.section === "catalog" && state.named ? NAMED_CATALOG.exec(text)?.groups?.name : undefined;
	return named === undefined ? state : { ...state, catalogName: named };
}

function entryAt(text: string, line: number, { catalogName, section }: ScanState): Entry | undefined {
	const entry = ENTRY.exec(text)?.groups;
	if (section === undefined || entry === undefined) {
		return undefined;
	}
	return {
		catalog: catalogName,
		line,
		name: entry.name ?? "",
		section,
		value: (entry.value ?? "").replace(/\s+#.*$/u, "").replace(/^["']|["']$/gu, ""),
	};
}

export function scanCatalog(workspace: string) {
	const entries: Entry[] = [];
	const findings: Finding[] = [];
	let state: ScanState = { catalogName: "default", named: false, section: undefined };
	for (const [index, text] of workspace.split("\n").entries()) {
		const heading = HEADING.exec(text)?.groups;
		if (heading !== undefined) {
			state = headingState(heading.key ?? "");
			findings.push(...inlineHeading(index + 1, heading.key ?? "", heading.rest ?? ""));
			continue;
		}
		state = lineState(state, text);
		const entry = entryAt(text, index + 1, state);
		if (entry !== undefined) {
			entries.push(entry);
		}
	}
	return { entries, findings };
}

export const catalog = Effect.fn("Quality.catalog")(function* ({ readText }: Pick<RuleInputs, "readText">) {
	const workspace = yield* readText(WORKSPACE);
	if (workspace === undefined) {
		return yield* new FilesystemFailure({ message: `required input is missing: ${WORKSPACE}`, path: WORKSPACE });
	}
	return scanCatalog(workspace);
});
