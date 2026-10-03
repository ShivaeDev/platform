import type { Inventory } from "#lint/inventory.ts";
import type { Violation } from "#lint/violation.ts";

const FILE = "pnpm-workspace.yaml";
const EXACT_VERSION = /^(npm:.+@)?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/u;
const HEADING = /^(["']?)(catalog|catalogs|overrides)\1\s*:(.*)$/u;
const SECTION_END = /^[^\s#]/u;
const ENTRY = /^\s+(?=[^\s#])(["']?)([^"':]+)\1\s*:\s*(\S.*)$/u;

type Section = "catalog" | "overrides";

interface Entry {
	readonly line: number;
	readonly name: string;
	readonly section: Section;
	readonly value: string;
}

const unquoted = (value: string): string => value.replace(/\s+#.*$/u, "").replace(/^["']|["']$/gu, "");

const inlineHeading = (line: number, key: string, rest: string): readonly Violation[] =>
	rest.replace(/#.*$/u, "").trim() === ""
		? []
		: [
				{
					file: FILE,
					line,
					message: `"${key}" holds an inline value. Write it as an indented block mapping so every entry is checked.`,
					rule: "manifests/workspace-section",
				},
			];

const scan = (workspace: string): { readonly entries: readonly Entry[]; readonly violations: readonly Violation[] } => {
	const entries: Entry[] = [];
	const violations: Violation[] = [];
	let section: Section | undefined;
	for (const [index, text] of workspace.split("\n").entries()) {
		const heading = HEADING.exec(text);
		if (heading !== null) {
			const key = heading[2] ?? "";
			section = key === "overrides" ? "overrides" : "catalog";
			violations.push(...inlineHeading(index + 1, key, heading[3] ?? ""));
			continue;
		}
		if (SECTION_END.test(text)) {
			section = undefined;
		}
		const entry = ENTRY.exec(text);
		if (section !== undefined && entry !== null) {
			entries.push({ line: index + 1, name: entry[2] ?? "", section, value: unquoted(entry[3] ?? "") });
		}
	}
	return { entries, violations };
};

const entryViolation = ({ line, name, section, value }: Entry): readonly Violation[] => {
	if (section === "catalog" && !EXACT_VERSION.test(value)) {
		return [
			{
				file: FILE,
				line,
				message: `catalog entry "${name}: ${value}" is not an exact version. Ranges are banned; pin the version and let upgrades be visible diffs.`,
				rule: "manifests/exact-catalog-version",
			},
		];
	}
	if (section === "overrides" && !value.startsWith("catalog:")) {
		return [
			{
				file: FILE,
				line,
				message: `override "${name}: ${value}" names a version outside the catalog. Pin the version in the catalog and override with "catalog:".`,
				rule: "manifests/catalog-overrides",
			},
		];
	}
	return [];
};

export const catalogViolations = (inventory: Inventory): readonly Violation[] => {
	const { entries, violations } = scan(inventory.workspaceCatalog);
	return [...violations, ...entries.flatMap(entryViolation)];
};
