import type { ExceptionDeclaration } from "#exceptions/declaration.ts";

function nativeOverride(files: readonly string[], rule: string): unknown {
	const [, tool, group = "", name = ""] = rule.split("/");
	const key = tool === "lint" ? "linter" : "assist";
	const settings = tool === "lint" ? "rules" : "actions";
	return { includes: files, [key]: { [settings]: { [group]: { [name]: "off" } } } };
}

export function fileExclusions(declarations: readonly ExceptionDeclaration[]): readonly ExceptionDeclaration[] {
	return declarations.flatMap((entry) =>
		entry.rules.includes("biome/files/includes") ? [{ ...entry, rules: ["biome/files/includes"] as const }] : [],
	);
}

export type RulesOff = Readonly<Record<string, Readonly<Record<string, "off">>>>;

function everywhere({ files, rule }: { readonly files: readonly string[]; readonly rule: string }): boolean {
	return rule.startsWith("biome/lint/") && files.length === 1 && files[0] === "**";
}

// A lint rule excepted for every file is turned off at the top level: an override that sets lint rules turns the linter back on where an earlier override disabled it.
export function exceptionConfig(declarations: readonly ExceptionDeclaration[]): {
	readonly includes: readonly string[];
	readonly overrides: readonly unknown[];
	readonly rules: RulesOff;
} {
	const includes = declarations.filter((entry) => entry.rules.includes("biome/files/includes")).flatMap((entry) => entry.files);
	const native = declarations.flatMap((entry) =>
		entry.rules.filter((rule) => /^biome\/(?:lint|assist)\//u.test(rule)).map((rule) => ({ files: entry.files, rule })),
	);
	const rules: Record<string, Record<string, "off">> = {};
	for (const { rule } of native.filter(everywhere)) {
		const [, , group = "", name = ""] = rule.split("/");
		rules[group] = { ...rules[group], [name]: "off" };
	}
	return {
		includes: includes.length === 0 ? [] : ["**", ...includes.filter((pattern) => pattern !== "**")],
		overrides: native.filter((entry) => !everywhere(entry)).map(({ files, rule }) => nativeOverride(files, rule)),
		rules,
	};
}
