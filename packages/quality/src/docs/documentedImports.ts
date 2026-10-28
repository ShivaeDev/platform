import ts from "typescript";
import { packageNameOf } from "#imports/packageName.ts";
import { codeSpans, type MarkdownLine, markdownLines } from "./markdownLines.ts";

export interface DocumentedImport {
	readonly line: number;
	readonly name?: string;
	readonly specifier: string;
	readonly typeOnly?: boolean;
}

export interface DocumentedScope {
	readonly owner?: string | undefined;
	readonly packages: (name: string) => boolean;
}

const CODE_LANGUAGES: ReadonlySet<string> = new Set(["js", "jsx", "mjs", "mts", "ts", "tsx", "typescript"]);

const MODULE = /^(?:@[\w.-]+\/)?[\w.-]+\/[\w./-]+\.[cm]?[jt]sx?$/u;

const OWN_MODULE = /^[\w-]+(?:\/[\w.-]+)*\.ts$/u;

const NAMED = /`(?<name>\w+)` from `(?<specifier>[^`]+)`/gu;

const HEADING = /^(?<level>#{1,6})\s+(?<title>.+)$/u;

function declarationImports(statement: ts.Statement, line: number): readonly DocumentedImport[] {
	if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))) {
		return [];
	}
	const specifier = statement.moduleSpecifier.text;
	const clause = statement.importClause;
	const named = clause?.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : [];
	return [
		{ line, specifier },
		...(clause?.name === undefined ? [] : [{ line, name: "default", specifier, typeOnly: clause.isTypeOnly }]),
		...named.map((entry) => ({
			line,
			name: (entry.propertyName ?? entry.name).text,
			specifier,
			typeOnly: clause?.isTypeOnly === true || entry.isTypeOnly,
		})),
	];
}

function codeBlocks(lines: readonly MarkdownLine[]): ReadonlyArray<{ readonly first: number; readonly text: string }> {
	const blocks: Array<{ first: number; text: string[] }> = [];
	for (const [index, line] of lines.entries()) {
		if (line.kind === "code" && CODE_LANGUAGES.has(line.language)) {
			const last = blocks.at(-1);
			if (last !== undefined && lines[index - 1]?.kind === "code") {
				last.text.push(line.text);
			} else {
				blocks.push({ first: line.number, text: [line.text] });
			}
		}
	}
	return blocks.map((block) => ({ first: block.first, text: block.text.join("\n") }));
}

function codeImports(lines: readonly MarkdownLine[]): readonly DocumentedImport[] {
	return codeBlocks(lines).flatMap((block) => {
		const file = ts.createSourceFile("block.tsx", block.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
		return file.statements.flatMap((statement) =>
			declarationImports(statement, block.first + file.getLineAndCharacterOfPosition(statement.getStart(file)).line),
		);
	});
}

function apiLevel(text: string, current: number | undefined): number | undefined {
	const heading = HEADING.exec(text);
	if (heading === null) {
		return current;
	}
	const level = heading.groups?.level?.length ?? 0;
	if (/^API\b/u.test(heading.groups?.title ?? "")) {
		return level;
	}
	return current !== undefined && level <= current ? undefined : current;
}

function firstCell(text: string): string {
	return text.startsWith("|") ? (text.split("|")[1] ?? "") : "";
}

function proseImports(lines: readonly MarkdownLine[], owner: string | undefined): readonly DocumentedImport[] {
	const found: DocumentedImport[] = [];
	let api: number | undefined;
	for (const { number: line, text } of lines.filter((entry) => entry.kind === "prose")) {
		api = apiLevel(text, api);
		found.push(...codeSpans(text).flatMap((span) => (MODULE.test(span) ? [{ line, specifier: span }] : [])));
		found.push(...[...text.matchAll(NAMED)].map((match) => ({ line, name: match.groups?.name ?? "", specifier: match.groups?.specifier ?? "" })));
		if (owner !== undefined) {
			const listed = api === undefined ? firstCell(text) : text;
			found.push(...codeSpans(listed).flatMap((span) => (OWN_MODULE.test(span) ? [{ line, specifier: `${owner}/${span}` }] : [])));
		}
	}
	return found;
}

export function documentedImports(markdown: string, scope: DocumentedScope): readonly DocumentedImport[] {
	const lines = markdownLines(markdown);
	return [...codeImports(lines), ...proseImports(lines, scope.owner)].filter((entry) => scope.packages(packageNameOf(entry.specifier)));
}
