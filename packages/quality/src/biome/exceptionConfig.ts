import type { ExceptionDeclaration } from "#exceptions/declaration.ts";

function nativeOverride(files: readonly string[], rule: string): unknown {
	const [, tool, group = "", name = ""] = rule.split("/");
	const key = tool === "lint" ? "linter" : "assist";
	const settings = tool === "lint" ? "rules" : "actions";
	return { includes: files, [key]: { [settings]: { [group]: { [name]: "off" } } } };
}

export function exceptionConfig(declarations: readonly ExceptionDeclaration[]): {
	readonly includes: readonly string[];
	readonly overrides: readonly unknown[];
} {
	const includes = declarations.filter((entry) => entry.rules.includes("biome/files/includes")).flatMap((entry) => entry.files);
	return {
		includes: includes.length === 0 ? [] : ["**", ...includes.filter((pattern) => pattern !== "**")],
		overrides: declarations.flatMap(({ files, rules }) =>
			rules.filter((rule) => /^biome\/(?:lint|assist)\//u.test(rule)).map((rule) => nativeOverride(files, rule)),
		),
	};
}
