import type { Finding, RuleInputs } from "@shivaedev/quality/rule.ts";

const HEADING = /^(?<quote>["']?)(?<key>catalog|catalogs|overrides)\k<quote>\s*:(?<rest>.*)$/u;
const SECTION_END = /^[^\s#]/u;
const ENTRY = /^\s+(?=[^\s#])(?<quote>["']?)(?<name>[^"':]+)\k<quote>\s*:\s*(?<value>\S.*)$/u;

interface Entry {
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

function scan(workspace: string) {
	const entries: Entry[] = [];
	const findings: Finding[] = [];
	let section: Entry["section"] | undefined;
	for (const [index, text] of workspace.split("\n").entries()) {
		const heading = HEADING.exec(text)?.groups;
		if (heading !== undefined) {
			section = heading.key === "overrides" ? "overrides" : "catalog";
			findings.push(...inlineHeading(index + 1, heading.key ?? "", heading.rest ?? ""));
			continue;
		}
		if (SECTION_END.test(text)) {
			section = undefined;
		}
		const entry = ENTRY.exec(text)?.groups;
		if (section !== undefined && entry !== undefined) {
			entries.push({
				line: index + 1,
				name: entry.name ?? "",
				section,
				value: (entry.value ?? "").replace(/\s+#.*$/u, "").replace(/^["']|["']$/gu, ""),
			});
		}
	}
	return { entries, findings };
}

export async function catalog({ readText }: Pick<RuleInputs, "readText">) {
	const workspace = await readText("pnpm-workspace.yaml");
	if (workspace === undefined) {
		throw new Error("required input is missing: pnpm-workspace.yaml");
	}
	return scan(workspace);
}
