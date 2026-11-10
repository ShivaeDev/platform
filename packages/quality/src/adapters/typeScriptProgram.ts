import { join } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
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

function compile(root: string, sources: readonly SourceFile[]): TypeScriptProgram {
	const texts = new Map(sources.map((source) => [join(root, source.path), source.text]));
	const projectOf = projectsFor(root);
	const host = ts.createCompilerHost(OPTIONS);
	const read = host.readFile;
	host.readFile = (path) => texts.get(path) ?? read(path);
	host.resolveModuleNames = (names, from) =>
		names.map((name) => {
			const project = projectOf(from);
			return ts.resolveModuleName(name, from, project.typesOptions, host, project.typesCache).resolvedModule;
		});
	const program = ts.createProgram([...texts.keys()], OPTIONS, host);
	return { checker: program.getTypeChecker(), program, sourceFile: (path) => program.getSourceFile(join(root, path)) };
}

export function typeScriptProgram(root: string, sources: readonly SourceFile[]): Effect.Effect<TypeScriptProgram> {
	let compiled: TypeScriptProgram | undefined;
	return Effect.sync(() => {
		compiled ??= compile(root, sources);
		return compiled;
	});
}
