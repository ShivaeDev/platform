import { join, relative, sep } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { DeclarationFiles } from "#adapters/declaration-files/service.ts";
import { projectsFor } from "#adapters/imports/projects.ts";
import type { RuleInputs } from "#rule.ts";

export const effectProgram = Effect.fn("EffectProgram.effectProgram")(function* (
	inputs: RuleInputs,
	externalTypes = true,
	roots: readonly string[] = [],
) {
	return (yield* effectPrograms(inputs, externalTypes, roots)).create(inputs.sources);
});

export const effectPrograms = Effect.fn("EffectProgram.effectPrograms")(function* (
	inputs: RuleInputs,
	externalTypes = true,
	roots: readonly string[] = [],
) {
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
			if (!(externalTypes || name.startsWith(".") || name.startsWith("#") || name.startsWith("@shivaedev/"))) {
				return undefined;
			}
			const project = projectOf(from);
			return ts.resolveModuleName(name, from, project.typesOptions, host, project.typesCache).resolvedModule;
		});
	const sourceFiles = new Map<string, ts.SourceFile>();
	const declarations = yield* DeclarationFiles;
	const readSource = yield* declarations.reader(host, options);
	host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => {
		const previous = sourceFiles.get(file);
		if (previous !== undefined && !shouldCreateNewSourceFile) {
			return previous;
		}
		const source = readSource(file, languageVersion, onError, shouldCreateNewSourceFile);
		if (source !== undefined) {
			sourceFiles.set(file, source);
		}
		return source;
	};
	return {
		create: (sources: RuleInputs["sources"]): ts.Program =>
			ts.createProgram([...sources.map((source) => join(inputs.root, source.path)), ...roots], options, host),
		release: () => {
			for (const file of sourceFiles.keys()) {
				const path = relative(inputs.root, file);
				if (!path.split(sep).includes("node_modules")) {
					sourceFiles.delete(file);
				}
			}
		},
	};
});
