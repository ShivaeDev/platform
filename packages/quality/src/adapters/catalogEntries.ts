import type { Finding } from "#rule.ts";

interface CatalogEntry {
	readonly catalog: string;
	readonly line: number;
	readonly name: string;
	readonly version: string;
}

interface CatalogScan {
	active: boolean;
	catalog: string;
	catalogIndent: number;
	readonly entries: CatalogEntry[];
	readonly findings: Finding[];
	named: boolean;
	present: boolean;
}

const HEADING = /^(?:catalog|["']catalog["'])\s*:\s*(?<default>.*)$|^(?:catalogs|["']catalogs["'])\s*:\s*(?<named>.*)$/u;
const MEMBER = /^(?<indent> +)(?:"(?<double>[^"]+)"|'(?<single>[^']+)'|(?<plain>[^\s:][^:]*)):\s*(?<value>.*)$/u;

function scalar(text: string): string {
	return text
		.replace(/\s+#.*$/u, "")
		.trim()
		.replace(/^["']|["']$/gu, "");
}

function finding(scan: CatalogScan, line: number, message: string): void {
	scan.findings.push({ file: "pnpm-workspace.yaml", line, message });
}

function heading(scan: CatalogScan, fields: Readonly<Record<string, string>>, line: number): void {
	scan.active = true;
	scan.present = true;
	scan.named = fields.named !== undefined;
	scan.catalog = "";
	scan.catalogIndent = 0;
	if (scalar(fields.named ?? fields.default ?? "") !== "") {
		finding(scan, line, "Write catalogs as indented block mappings so every dependency pin can be checked.");
	}
}

function member(scan: CatalogScan, text: string, line: number): void {
	const fields = MEMBER.exec(text)?.groups;
	const name = fields?.double ?? fields?.single ?? fields?.plain;
	if (fields === undefined || name === undefined) {
		finding(scan, line, "Write this catalog entry as a name and an exact version in an indented block mapping.");
		return;
	}
	const indent = fields.indent?.length ?? 0;
	const value = scalar(fields.value ?? "");
	if (scan.named && (scan.catalogIndent === 0 || indent <= scan.catalogIndent)) {
		scan.catalog = name;
		scan.catalogIndent = indent;
		if (value !== "") {
			finding(scan, line, "Write this named catalog as an indented block mapping of exact dependency pins.");
		}
		return;
	}
	scan.entries.push({ catalog: scan.catalog, line, name: name.trim(), version: value });
}

export function catalogEntries(text: string) {
	const scan: CatalogScan = { active: false, catalog: "", catalogIndent: 0, entries: [], findings: [], named: false, present: false };
	for (const [index, line] of text.split("\n").entries()) {
		const fields = HEADING.exec(line)?.groups;
		if (fields !== undefined) {
			heading(scan, fields, index + 1);
			continue;
		}
		if (/^[^\s#]/u.test(line)) {
			scan.active = false;
		}
		if (scan.active && !/^\s*(?:#.*)?$/u.test(line)) {
			member(scan, line, index + 1);
		}
	}
	return { entries: scan.entries, findings: scan.findings, present: scan.present };
}
