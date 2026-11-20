import { join } from "node:path";
import { Effect, FileSystem } from "effect";
import ts from "typescript";
import { requireThat } from "#package-check/io.ts";
import { checkRuntimeImports } from "#starter-published/checkRuntimeImports.ts";
import { type DocumentedImport, documentedImports, importProbe, packageName } from "#starter-published/imports.ts";

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
	const guides = (yield* fs.readDirectory(join(root, "docs/framework"))).filter((name) => name.endsWith(".md")).sort();
	for (const source of [...guides.map((name) => `docs/framework/${name}`), "examples/starter/README.md"]) {
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
	source = "pinned npm releases",
) {
	const fs = yield* FileSystem.FileSystem;
	const path = join(consumer, "documented-imports.ts");
	yield* fs.writeFileString(path, entries.map(importProbe).join("\n"));
	const program = yield* Effect.sync(() => probeProgram(path));
	const problems = importProblems(program, entries, versions);
	yield* requireThat(problems.length === 0, `Published documentation API check failed:\n${problems.join("\n")}`);
	yield* checkRuntimeImports(consumer, runtimeEntries(program, path, entries), versions);
	yield* Effect.log(`Checked ${entries.length} documented imports against ${source}.`);
});

function probeProgram(path: string): ts.Program {
	return ts.createProgram([path], {
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		noEmit: true,
		skipLibCheck: true,
		strict: true,
		target: ts.ScriptTarget.ESNext,
		types: [],
		verbatimModuleSyntax: true,
	});
}

function importProblems(program: ts.Program, entries: readonly DocumentedImport[], versions: Readonly<Record<string, string>>): string[] {
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

function runtimeEntries(program: ts.Program, path: string, entries: readonly DocumentedImport[]): DocumentedImport[] {
	const checker = program.getTypeChecker();
	const file = program.getSourceFile(path);
	const module = file === undefined ? undefined : checker.getSymbolAtLocation(file);
	const values = new Set(
		(module === undefined ? [] : checker.getExportsOfModule(module))
			.filter((symbol) => (checker.getAliasedSymbol(symbol).flags & ts.SymbolFlags.Value) !== 0)
			.map((symbol) => symbol.name),
	);
	return entries.filter(
		(entry, index) => entry.name === undefined || entry.typeOnly === false || (entry.typeOnly === undefined && values.has(`entry${index}`)),
	);
}
