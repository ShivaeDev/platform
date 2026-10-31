import type { SeedFile } from "./tree.ts";

export type Line = readonly [code: string, ...findings: string[]];

const PLUGINS: ReadonlyArray<readonly [prefix: string, plugin: string]> = [
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

export function pluginOf(message: string): string {
	return PLUGINS.find(([prefix]) => message.startsWith(prefix))?.[1] ?? message;
}

export function namingSource(path: string, lines: readonly Line[]): SeedFile {
	return { content: `${lines.map(([code]) => code).join("\n")}\n`, path };
}

export function expectedPlugins(lines: readonly Line[]): readonly string[] {
	return lines.flatMap(([, ...findings], index) => findings.map((finding) => `${index + 1} ${finding}`)).toSorted();
}
