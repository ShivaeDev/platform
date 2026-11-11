import { relative } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { sharedErrorModules } from "#adapters/sharedErrorModules.ts";
import type { RuleInputs } from "#rule.ts";
import { taggedClasses } from "#rules/effect/errorTags.ts";

export interface SharedError {
	readonly name: string;
	readonly path: string;
	readonly specifier: string;
}

export interface SharedErrorCatalog {
	readonly byTag: ReadonlyMap<string, SharedError>;
	readonly tagOf: (specifier: string, name: string) => string | undefined;
}

// Published packages ship their sources beside the declarations, and a source states each tag as a literal where a declaration buries it in a type.
function moduleSource(file: string): ts.SourceFile | undefined {
	const published = file.replace(/\/dist\/(?<module>.+)\.d\.(?<kind>[cm]?)ts$/u, "/src/$<module>.$<kind>ts");
	const path = published !== file && ts.sys.fileExists(published) ? published : file;
	const text = ts.sys.readFile(path);
	return text === undefined ? undefined : ts.createSourceFile(ts.sys.realpath?.(path) ?? path, text, ts.ScriptTarget.Latest, true);
}

export const sharedErrorCatalog = Effect.fn("SharedErrors.sharedErrorCatalog")(function* (inputs: Pick<RuleInputs, "readText" | "root" | "sources">) {
	const root = ts.sys.realpath?.(inputs.root) ?? inputs.root;
	const byTag = new Map<string, SharedError>();
	const bySpecifier = new Map<string, Map<string, string>>();
	for (const { file, specifier } of yield* sharedErrorModules(inputs)) {
		const source = moduleSource(file);
		const exported = (source === undefined ? [] : taggedClasses(source, () => undefined)).filter(
			({ name, node }) => name !== undefined && ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export,
		);
		for (const { name = "", tag } of exported) {
			byTag.set(tag, { name, path: relative(root, source?.fileName ?? file).replaceAll("\\", "/"), specifier });
			bySpecifier.set(specifier, new Map([...(bySpecifier.get(specifier) ?? []), [name, tag]]));
		}
	}
	const catalog: SharedErrorCatalog = { byTag, tagOf: (specifier, name) => bySpecifier.get(specifier)?.get(name) };
	return catalog;
});
