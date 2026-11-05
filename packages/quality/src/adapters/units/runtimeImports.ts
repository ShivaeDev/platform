import ts from "typescript";
import { importFrom } from "#rules/stories/importOrigin.ts";

export interface RuntimeName {
	readonly module: string;
	readonly path: readonly string[];
}

export function runtimeImport(module: string | undefined, path: readonly string[]): RuntimeName | undefined {
	if (module === undefined || !(module === "effect" || module.startsWith("effect/") || module === "@effect/vitest")) {
		return undefined;
	}
	const subpath = /^effect\/(?:testing\/)?(?<name>Effect|Clock|TestClock)$/u.exec(module)?.groups?.name;
	return subpath === undefined ? { module: module === "effect/testing" ? "effect" : module, path } : { module: "effect", path: [subpath, ...path] };
}

function assignedRuntime(node: ts.ImportEqualsDeclaration): RuntimeName | undefined {
	if (node.isTypeOnly || !ts.isExternalModuleReference(node.moduleReference)) {
		return undefined;
	}
	const module = node.moduleReference.expression;
	return module !== undefined && ts.isStringLiteralLike(module) ? runtimeImport(module.text, []) : undefined;
}

export function importedRuntime(node: ts.Node): RuntimeName | undefined {
	if (ts.isImportSpecifier(node)) {
		return node.isTypeOnly || node.parent.parent.isTypeOnly ? undefined : runtimeImport(importFrom(node), [(node.propertyName ?? node.name).text]);
	}
	if (ts.isNamespaceImport(node)) {
		return node.parent.isTypeOnly ? undefined : runtimeImport(importFrom(node), []);
	}
	return ts.isImportEqualsDeclaration(node) ? assignedRuntime(node) : undefined;
}

export function exportedRuntime(node: ts.ExportSpecifier | ts.NamespaceExport): RuntimeName | undefined {
	const statement = ts.isExportSpecifier(node) ? node.parent.parent : node.parent;
	if (statement.isTypeOnly || (ts.isExportSpecifier(node) && node.isTypeOnly)) {
		return undefined;
	}
	const module = statement.moduleSpecifier;
	return module !== undefined && ts.isStringLiteral(module)
		? runtimeImport(module.text, ts.isExportSpecifier(node) ? [(node.propertyName ?? node.name).text] : [])
		: undefined;
}

export function runtimeOf(name: RuntimeName | undefined): string | undefined {
	if (name?.module === "effect") {
		const [head, property] = name.path;
		if (head === "Clock" || head === "TestClock") {
			return name.path.join(".");
		}
		return head === "Effect" && property?.startsWith("run") === true ? `Effect.${property}` : undefined;
	}
	const [head, property] = name?.path ?? [];
	return name?.module === "@effect/vitest"
		&& (head === "it" || head === "test")
		&& ["effect", "live", "scoped", "scopedLive"].includes(property ?? "")
		? `${head}.${property}`
		: undefined;
}
