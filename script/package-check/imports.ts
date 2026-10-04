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
export function importEntry(imports: ImportMap, specifier: string): unknown {
	if (specifier in imports && !specifier.includes("*")) {
		return imports[specifier];
	}
	const [best] = Object.keys(imports)
		.flatMap((key) => {
			const star = patternMatch(key, specifier);
			return star === undefined ? [] : [{ key, star }];
		})
		.sort((left, right) => right.key.indexOf("*") - left.key.indexOf("*") || right.key.length - left.key.length);
	return best === undefined ? undefined : substitute(imports[best.key], best.star);
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

// Every packed module's "#" import must name an imports entry whose every target, for any condition a consumer may set, is packed.
export function missingImportTargets(imports: ImportMap, packed: ReadonlySet<string>, sources: ReadonlyMap<string, string>): string[] {
	return [...sources].flatMap(([path, source]) =>
		ts
			.preProcessFile(source)
			.importedFiles.filter(({ fileName }) => fileName.startsWith("#"))
			.flatMap(({ fileName }) => aliasProblems(imports, packed, path, fileName)),
	);
}
