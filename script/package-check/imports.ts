import { posix } from "node:path";
import ts from "typescript";
import { targets } from "#package-check/model.ts";

type ImportMap = Readonly<Record<string, unknown>>;

export const CODE = /\.(?:d\.ts|js|ts|tsx)$/u;

function patternMatch(key: string, specifier: string): string | undefined {
	const [prefix = "", suffix, ...rest] = key.split("*");
	if (suffix === undefined || rest.length > 0 || specifier.length < key.length - 1) {
		return undefined;
	}
	return specifier.startsWith(prefix) && specifier.endsWith(suffix) ? specifier.slice(prefix.length, specifier.length - suffix.length) : undefined;
}

function substitute(value: unknown, star: string): unknown {
	if (typeof value === "string") {
		return value.replaceAll("*", star);
	}
	if (typeof value !== "object" || value === null) {
		return value;
	}
	return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, substitute(entry, star)]));
}

// Node picks the exact key, then the pattern with the longest prefix before its "*".
export function importKey(imports: ImportMap, specifier: string): string | undefined {
	if (specifier in imports && !specifier.includes("*")) {
		return specifier;
	}
	const [best] = Object.keys(imports)
		.flatMap((key) => {
			const star = patternMatch(key, specifier);
			return star === undefined ? [] : [{ key, star }];
		})
		.sort((left, right) => right.key.indexOf("*") - left.key.indexOf("*") || right.key.length - left.key.length);
	return best?.key;
}

export function importEntry(imports: ImportMap, specifier: string): unknown {
	const key = importKey(imports, specifier);
	if (key === undefined) {
		return undefined;
	}
	const star = patternMatch(key, specifier);
	return star === undefined ? imports[key] : substitute(imports[key], star);
}

export function conditionalTarget(value: unknown, conditions: readonly string[]): string | undefined {
	if (typeof value === "string") {
		return value;
	}
	if (typeof value !== "object" || value === null) {
		return undefined;
	}
	for (const [condition, target] of Object.entries(value)) {
		if (condition === "default" || conditions.includes(condition)) {
			return conditionalTarget(target, conditions);
		}
	}
	return undefined;
}

function aliasProblems(imports: ImportMap, packed: ReadonlySet<string>, path: string, specifier: string): string[] {
	const entry = importEntry(imports, specifier);
	if (entry === undefined) {
		return [`${path} imports ${specifier}, which no imports entry declares`];
	}
	return targets(entry)
		.filter((target) => !packed.has(posix.normalize(target)))
		.map((target) => `${path} imports ${specifier}, whose target ${target} is not packed`);
}

function literalText(node: ts.Node | undefined): string | undefined {
	return node !== undefined && ts.isStringLiteralLike(node) ? node.text : undefined;
}

function moduleName(node: ts.Node, file: ts.SourceFile): string | undefined {
	if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
		return literalText(node.moduleSpecifier);
	}
	if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
		return literalText(node.moduleReference.expression);
	}
	if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
		return literalText(node.arguments[0]);
	}
	if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
		return literalText(node.argument.literal);
	}
	return ts.isModuleDeclaration(node) && ts.isExternalModule(file) ? literalText(node.name) : undefined;
}

function moduleNames(path: string, source: string): string[] {
	const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest);
	const names: string[] = [];
	function visit(node: ts.Node): void {
		const name = moduleName(node, file);
		if (name !== undefined) {
			names.push(name);
		}
		ts.forEachChild(node, visit);
	}
	visit(file);
	return names;
}

// Every packed module's "#" import must name an imports entry whose every target, for any condition a consumer may set, is packed.
// A real parse, because a token scan reads a quote inside a regex as a string opener and then reports text in the template literal after it.
export function missingImportTargets(imports: ImportMap, packed: ReadonlySet<string>, sources: ReadonlyMap<string, string>): string[] {
	return [...sources].flatMap(([path, source]) =>
		moduleNames(path, source)
			.filter((name) => name.startsWith("#"))
			.flatMap((name) => aliasProblems(imports, packed, path, name)),
	);
}
