import { join } from "node:path";
import ts from "typescript";
import { projectsFor } from "#adapters/imports/projects.ts";
import type { RuleInputs } from "#rule.ts";

export function effectProgram(inputs: RuleInputs, externalTypes = true, roots: readonly string[] = []): ts.Program {
	return effectPrograms(inputs, externalTypes, roots)(inputs.sources);
}

export function effectPrograms(inputs: RuleInputs, externalTypes = true, roots: readonly string[] = []) {
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
	const readSource = host.getSourceFile;
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
	return (sources: RuleInputs["sources"]): ts.Program =>
		ts.createProgram([...sources.map((source) => join(inputs.root, source.path)), ...roots], options, host);
}
