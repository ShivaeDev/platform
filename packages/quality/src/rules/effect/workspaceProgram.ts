import { join } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { DeclarationFiles } from "#adapters/declaration-files/service.ts";
import { projectsFor } from "#adapters/imports/projects.ts";
import type { RuleInputs } from "#rule.ts";

// Imports of installed packages stay unresolved: these rules judge the repository's own code and treat outside libraries as untyped.
export const workspaceProgram = Effect.fn("WorkspaceProgram.workspaceProgram")(function* (inputs: RuleInputs) {
	const projectOf = projectsFor(inputs.root);
	const options: ts.CompilerOptions = {
		allowJs: true,
		jsx: ts.JsxEmit.Preserve,
		skipLibCheck: true,
		strict: true,
		target: ts.ScriptTarget.ESNext,
		types: [],
	};
	const host = ts.createCompilerHost(options);
	const texts = new Map(inputs.sources.map((source) => [join(inputs.root, source.path), source.text]));
	const read = host.readFile;
	host.readFile = (path) => texts.get(path) ?? read(path);
	host.resolveModuleNames = (names, from) =>
		names.map((name) => {
			if (!(name.startsWith(".") || name.startsWith("#") || name.startsWith("@shivaedev/"))) {
				return undefined;
			}
			const project = projectOf(from);
			return ts.resolveModuleName(name, from, project.typesOptions, host, project.typesCache).resolvedModule;
		});
	const declarations = yield* DeclarationFiles;
	host.getSourceFile = yield* declarations.reader(host, options);
	return ts.createProgram([...texts.keys()], options, host);
});
