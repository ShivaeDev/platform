import { join } from "node:path";
import ts from "typescript";
import { projectsFor } from "#imports/projects.ts";
import type { RuleInputs } from "#rule.ts";

export function effectProgram(inputs: RuleInputs): ts.Program {
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
			const project = projectOf(from);
			return ts.resolveModuleName(name, from, project.typesOptions, host, project.typesCache).resolvedModule;
		});
	return ts.createProgram([...texts.keys()], options, host);
}
