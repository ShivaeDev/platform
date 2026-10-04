import { posix } from "node:path";
import ts from "typescript";
import type { RuleInputs, SourceFile } from "#rule.ts";
import { parse } from "#rules/syntax.ts";
import { type PackageImports, packageImports } from "./packageImports.ts";

const STYLESHEET = /\.s?css$/u;

const MENTIONS_STYLESHEET = /\.s?css["'?]/u;

const CSS_IMPORT = /@import\s+(?:url\(\s*)?(?<quote>["']?)(?<target>[^"'()\s;]+)\k<quote>/gu;

const CSS_COMMENT = /\/\*[\s\S]*?\*\//gu;

const QUERY = /\?.*$/u;

const PACKAGE_IMPORT = "#";

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/)/iu;

function moduleImports(file: SourceFile): readonly string[] {
	const source = MENTIONS_STYLESHEET.test(file.text) ? parse(file) : undefined;
	return (source?.statements ?? []).flatMap((statement) =>
		ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) ? [statement.moduleSpecifier.text] : [],
	);
}

function cssImports(text: string): readonly string[] {
	return [...text.replace(CSS_COMMENT, "").matchAll(CSS_IMPORT)].flatMap((match) => match.groups?.target ?? []);
}

function resolver(aliases: PackageImports, present: ReadonlySet<string>, fromStylesheet: boolean) {
	return (importer: string, raw: string): string | undefined => {
		const specifier = raw.replace(QUERY, "");
		if (specifier.startsWith(PACKAGE_IMPORT)) {
			return aliases(importer, specifier);
		}
		const relative = specifier.startsWith(".") || (fromStylesheet && !EXTERNAL.test(specifier));
		const path = posix.normalize(posix.join(posix.dirname(importer), specifier));
		return relative && present.has(path) ? path : undefined;
	};
}

export async function stylesheetImporters(
	inputs: Pick<RuleInputs, "files" | "readText" | "sources">,
): Promise<ReadonlyMap<string, readonly string[]>> {
	const present = new Set(inputs.files);
	const aliases = await packageImports(inputs);
	const stylesheets = await Promise.all(
		inputs.files.filter((path) => STYLESHEET.test(path)).map(async (path) => ({ path, text: (await inputs.readText(path)) ?? "" })),
	);
	const fromModule = resolver(aliases, present, false);
	const fromStylesheet = resolver(aliases, present, true);
	const edges = [
		...inputs.sources.flatMap((source) => moduleImports(source).map((specifier) => [source.path, fromModule(source.path, specifier)] as const)),
		...stylesheets.flatMap((sheet) => cssImports(sheet.text).map((specifier) => [sheet.path, fromStylesheet(sheet.path, specifier)] as const)),
	];
	const found = new Map<string, readonly string[]>();
	for (const [importer, target] of edges) {
		if (target !== undefined && STYLESHEET.test(target)) {
			found.set(target, [...new Set([...(found.get(target) ?? []), importer])]);
		}
	}
	return found;
}
