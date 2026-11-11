import { join } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { DeclarationFiles } from "#adapters/declaration-files/service.ts";
import { projectsFor } from "#adapters/imports/projects.ts";
import type { SourceFile, TypeScriptProgram } from "#rule.ts";

const OPTIONS: ts.CompilerOptions = {
	allowJs: true,
	jsx: ts.JsxEmit.Preserve,
	skipLibCheck: true,
	strict: true,
	target: ts.ScriptTarget.ESNext,
	types: [],
};

const compile = Effect.fn("TypeScriptProgram.compile")(function* (
	root: string,
	files: readonly string[],
	texts: ReadonlyMap<string, string>,
	projectOf: ReturnType<typeof projectsFor>,
) {
	const host = ts.createCompilerHost(OPTIONS);
	const read = host.readFile;
	host.readFile = (path) => texts.get(path) ?? read(path);
	host.resolveModuleNames = (names, from) =>
		names.map((name) => {
			const project = projectOf(from);
			return ts.resolveModuleName(name, from, project.typesOptions, host, project.typesCache).resolvedModule;
		});
	const declarations = yield* DeclarationFiles;
	host.getSourceFile = yield* declarations.reader(host, OPTIONS);
	const program = ts.createProgram([...files], OPTIONS, host);
	const compiled: TypeScriptProgram = {
		checker: program.getTypeChecker(),
		program,
		sourceFile: (path) => program.getSourceFile(join(root, path)),
		ts,
	};
	return compiled;
});

// Programs built with the same projects share their parsed tsconfigs and module resolutions.
export const sourcesProgram = Effect.fn("TypeScriptProgram.sourcesProgram")(function* (
	root: string,
	sources: readonly SourceFile[],
	projectOf = projectsFor(root),
) {
	const texts = new Map(sources.map((source) => [join(root, source.path), source.text]));
	return yield* compile(root, [...texts.keys()], texts, projectOf);
});

// Rules receive the program as an Effect without requirements, so it keeps the declaration files of the run that scanned the sources.
export const typeScriptProgram = Effect.fn("TypeScriptProgram.typeScriptProgram")(function* (root: string, sources: readonly SourceFile[]) {
	const declarations = yield* DeclarationFiles;
	return yield* Effect.cached(sourcesProgram(root, sources).pipe(Effect.provideService(DeclarationFiles, declarations)));
});
