import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import ts from "typescript";
import { requireThat } from "#package-check/io.ts";
import { checkRuntimeImports } from "./checkRuntimeImports.ts";
import { type DocumentedImport, documentedImports, importProbe, packageName } from "./imports.ts";

export const readDocumentation = Effect.fn("Published.readDocumentation")(function* (root: string, versions: Readonly<Record<string, string>>) {
	const fs = yield* FileSystem.FileSystem;
	const entries: DocumentedImport[] = [];
	for (const name of Object.keys(versions)) {
		if (name === "@shivaedev/quality") {
			continue;
		}
		const source = `packages/${name.split("/")[1]}/README.md`;
		entries.push(...documentedImports(yield* fs.readFileString(join(root, source)), source, name));
	}
	for (const source of ["docs/framework/quickstart.md", "examples/starter/README.md"]) {
		entries.push(...documentedImports(yield* fs.readFileString(join(root, source)), source));
	}
	for (const entry of entries) {
		yield* requireThat(packageName(entry.specifier) in versions, `${entry.source}: ${entry.specifier} needs a pinned published version`);
	}
	return entries;
});

export const checkDocumentation = Effect.fn("Published.checkDocumentation")(function* (
	consumer: string,
	entries: readonly DocumentedImport[],
	versions: Readonly<Record<string, string>>,
) {
	const fs = yield* FileSystem.FileSystem;
	const path = join(consumer, "documented-imports.ts");
	yield* fs.writeFileString(path, entries.map(importProbe).join("\n"));
	const problems = yield* Effect.sync(() => importProblems(path, entries, versions));
	yield* requireThat(problems.length === 0, `Published documentation API check failed:\n${problems.join("\n")}`);
	yield* checkRuntimeImports(consumer, entries, versions);
	yield* Effect.log(`Checked ${entries.length} documented imports against pinned npm releases.`);
});

export function importProblems(path: string, entries: readonly DocumentedImport[], versions: Readonly<Record<string, string>>): string[] {
	const program = ts.createProgram([path], {
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		noEmit: true,
		skipLibCheck: true,
		strict: true,
		target: ts.ScriptTarget.ESNext,
		types: [],
		verbatimModuleSyntax: true,
	});
	return ts.getPreEmitDiagnostics(program).map((diagnostic) => {
		const line = diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line;
		const entry = line === undefined ? undefined : entries[line];
		const detail = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
		if (entry === undefined) {
			return detail;
		}
		const name = packageName(entry.specifier);
		return `${name}@${versions[name]}: import ${entry.name ?? "*"} from ${entry.specifier} (${entry.source}): ${detail}`;
	});
}
