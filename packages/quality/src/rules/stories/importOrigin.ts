import ts from "typescript";

export function importFrom(node: ts.Node): string | undefined {
	for (let current: ts.Node | undefined = node; current !== undefined; current = current.parent) {
		if (ts.isImportDeclaration(current) && ts.isStringLiteral(current.moduleSpecifier)) {
			return current.moduleSpecifier.text;
		}
	}
	return undefined;
}

function moduleOrigin(from: string | undefined) {
	if (from === "vitest" || from === "@effect/vitest") {
		return "vitest";
	}
	return from === "@shivaedev/test-story" || from === "@shivaedev/test-story/server/storyKit.ts" ? "stories" : undefined;
}

export function importOrigin(from: string | undefined, name?: string) {
	if ((from === "@shivaedev/test/makeEffectIt.ts" || from === "@shivaedev/test/adapters/makeEffectIt.ts") && name === "makeEffectIt") {
		return "effectFactory";
	}
	if ((from === "@shivaedev/test/it.ts" || from === "@shivaedev/test/adapters/it.ts") && name === "it") {
		return "plain";
	}
	const namespace = moduleOrigin(from);
	if (name === undefined) {
		return namespace;
	}
	if (name === "storyKit" && namespace === "stories") {
		return "factory";
	}
	if ((name === "describe" || name === "suite") && namespace === "vitest") {
		return "suite";
	}
	return (name === "it" || name === "test") && namespace === "vitest" ? "plain" : undefined;
}
