import { join } from "node:path";
import ts from "typescript";
import { projectsFor } from "#adapters/imports/projects.ts";
import type { ImportGraph } from "#imports/graph.ts";
import type { RuleInputs } from "#rule.ts";

const programs = new WeakMap<RuleInputs["sources"], ts.Program>();

export function storyProgram(inputs: RuleInputs, graph: ImportGraph): ts.Program {
	const known = programs.get(inputs.sources);
	if (known !== undefined) {
		return known;
	}
	const sources = new Map(inputs.sources.map((file) => [join(inputs.root, file.path), file.text]));
	const targets = new Map(
		graph.edges.flatMap((edge) =>
			edge.to.kind === "file" ? [[`${join(inputs.root, edge.from)}:${edge.specifier}`, join(inputs.root, edge.to.path)] as const] : [],
		),
	);
	const options: ts.CompilerOptions = { allowJs: true, noLib: true, types: [] };
	const projectOf = projectsFor(inputs.root);
	const host: ts.CompilerHost = {
		...ts.createCompilerHost(options),
		fileExists: (path) => sources.has(path) || ts.sys.fileExists(path),
		getSourceFile: (path) => {
			const text = sources.get(path) ?? ts.sys.readFile(path);
			return text === undefined ? undefined : ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
		},
		readFile: (path) => sources.get(path) ?? ts.sys.readFile(path),
		resolveModuleNames: (names, from) =>
			names.map((name) => {
				const path = targets.get(`${from}:${name}`);
				if (path !== undefined) {
					return { extension: ts.Extension.Ts, resolvedFileName: path };
				}
				if (!(name.startsWith("@shivaedev/") || name.startsWith(".") || name.startsWith("#"))) {
					return undefined;
				}
				const project = projectOf(from);
				return ts.resolveModuleName(name, from, project.typesOptions, host, project.typesCache).resolvedModule;
			}),
	};
	const program = ts.createProgram([...sources.keys()], options, host);
	programs.set(inputs.sources, program);
	return program;
}
