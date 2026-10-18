import type { Diagnostic } from "#biome/report.ts";

export type Line = readonly [code: string, ...findings: string[]];

export const PLUGINS: ReadonlyArray<readonly [prefix: string, plugin: string]> = [
	["A module-level constant", "constant-names"],
	["A top-level function whose whole body is Effect.gen", "effect-fn-functions"],
	["A test body that is only Effect.gen", "effect-test-bodies"],
	["Effect.fn takes a literal span name", "effect-fn-spans"],
	["The operation in an Effect.fn span", "effect-fn-spans"],
	["A function passed to an onX prop", "handler-names"],
	["An object key or type property", "key-names"],
	["A schema is PascalCase", "schema-names"],
	["A Schema.Struct field", "schema-struct-keys"],
	["A service's Layer", "service-layers"],
	["A module never re-exports", "type-re-exports"],
];

export function nameOf(diagnostic: Diagnostic): string | undefined {
	if (diagnostic.category === "plugin") {
		return PLUGINS.find(([prefix]) => diagnostic.message.startsWith(prefix))?.[1];
	}
	return undefined;
}

export function expected(lines: readonly Line[]): readonly string[] {
	return lines.flatMap(([, ...findings], index) => findings.map((finding) => `${index + 1} ${finding}`)).toSorted();
}
