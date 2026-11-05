import ts from "typescript";
import { importFrom } from "./importOrigin.ts";

export interface RuntimeName {
	readonly module: string;
	readonly path: readonly string[];
}

export function runtimeImport(module: string | undefined, path: readonly string[]): RuntimeName | undefined {
	if (module === undefined || !(module === "effect" || module.startsWith("effect/") || module === "@effect/vitest")) {
		return undefined;
	}
	const subpath = /^effect\/(?<name>Effect|Clock|TestClock)$/u.exec(module)?.groups?.name;
	return subpath === undefined ? { module, path } : { module: "effect", path: [subpath, ...path] };
}

export function importedRuntime(node: ts.Node): RuntimeName | undefined {
	if (ts.isImportSpecifier(node)) {
		return node.isTypeOnly || node.parent.parent.isTypeOnly ? undefined : runtimeImport(importFrom(node), [(node.propertyName ?? node.name).text]);
	}
	if (ts.isNamespaceImport(node)) {
		return node.parent.isTypeOnly ? undefined : runtimeImport(importFrom(node), []);
	}
	return undefined;
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
