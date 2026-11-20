import { resolve } from "node:path";
import ts from "typescript";
import { syntaxOf } from "#adapters/biome/syntaxOf.ts";
import { browserDiagnostic } from "#biome/browserDiagnostic.ts";
import { pluginContract } from "#biome/pluginContract.ts";
import type { Diagnostic } from "#biome/report.ts";
import { nodeAt, offsetOf, type Syntax } from "#biome/syntax.ts";
import { vitestEntry } from "#biome/vitestEntry.ts";

const RECOGNIZED: ReadonlySet<string> = new Set([
	"lint/style/noDoneCallback",
	"lint/style/noDefaultExport",
	"lint/suspicious/noShadowRestrictedNames",
]);

// Effect names these root modules after the globals they extend, and its own docs import them unaliased.
const EFFECT_GLOBALS: ReadonlySet<string> = new Set(["Array", "BigInt", "Boolean", "Function", "Number", "RegExp", "String", "Symbol"]);

function generatorParameter(node: ts.Node, syntax: Syntax): boolean {
	const parameter = node.parent;
	const callback = parameter.parent;
	return (
		ts.isParameter(parameter)
		&& parameter.name === node
		&& ts.isFunctionExpression(callback)
		&& callback.asteriskToken !== undefined
		&& ts.isCallExpression(callback.parent)
		&& callback.parent.arguments.includes(callback)
		&& !vitestEntry(callback.parent.expression, syntax)
	);
}

function effectGlobal(node: ts.Node): boolean {
	const specifier = node.parent;
	if (!(ts.isIdentifier(node) && EFFECT_GLOBALS.has(node.text) && ts.isImportSpecifier(specifier)) || specifier.name !== node) {
		return false;
	}
	const declaration = specifier.parent.parent.parent;
	return (
		(specifier.propertyName ?? specifier.name).text === node.text
		&& ts.isStringLiteral(declaration.moduleSpecifier)
		&& declaration.moduleSpecifier.text === "effect"
	);
}

function misclassified(diagnostic: Diagnostic, syntax: Syntax): boolean {
	if (diagnostic.category === "lint/style/noDefaultExport") {
		return pluginContract(syntax);
	}
	const { start, end } = diagnostic.location;
	const from = start === undefined ? undefined : offsetOf(syntax.source, start);
	const to = end === undefined ? undefined : offsetOf(syntax.source, end);
	const node = from === undefined || to === undefined ? undefined : nodeAt(syntax.source, from, to);
	if (node === undefined) {
		return false;
	}
	switch (diagnostic.category) {
		case "lint/style/noDoneCallback":
			return generatorParameter(node, syntax);
		case "lint/suspicious/noShadowRestrictedNames":
			return effectGlobal(node);
		default:
			return false;
	}
}

export function recognizeDiagnostics(
	root: string,
	diagnostics: readonly Diagnostic[],
	toolDefaults: ReadonlySet<string> = new Set(),
): readonly Diagnostic[] {
	const sources = new Map<string, Syntax>();
	const candidates = diagnostics.filter(
		(diagnostic) =>
			diagnostic.category !== "lint/style/noDefaultExport"
			|| diagnostic.location.path === undefined
			|| !toolDefaults.has(resolve(root, diagnostic.location.path)),
	);
	return candidates.flatMap((diagnostic) => {
		const path = diagnostic.location.path;
		if (path === undefined) {
			return [diagnostic];
		}
		if (diagnostic.category === "lint/suspicious/useBaseline") {
			const recognized = browserDiagnostic(diagnostic, resolve(root, path));
			return recognized === undefined ? [] : [recognized];
		}
		if (!RECOGNIZED.has(diagnostic.category ?? "")) {
			return [diagnostic];
		}
		const file = resolve(root, path);
		const syntax = sources.get(file) ?? syntaxOf(file);
		sources.set(file, syntax);
		return misclassified(diagnostic, syntax) ? [] : [diagnostic];
	});
}
