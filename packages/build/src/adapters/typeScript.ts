import { dirname } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { moduleCalls } from "#adapters/moduleCalls.ts";
import { moduleFacts } from "#adapters/moduleFacts.ts";
import { BuildFailure } from "#BuildFailure.ts";

export interface ProjectConfig {
	// The tsconfig and every file it extends, which decide how the project's types read.
	readonly chain: readonly string[];
	readonly declarations: readonly string[];
	readonly files: readonly string[];
	readonly options: ts.CompilerOptions;
	readonly typeScriptVersion: string;
}

function diagnosticText(diagnostics: readonly ts.Diagnostic[]): string {
	return ts.formatDiagnostics(diagnostics, {
		getCanonicalFileName: (name) => name,
		getCurrentDirectory: ts.sys.getCurrentDirectory,
		getNewLine: () => "\n",
	});
}

export const readConfig = Effect.fn("Build.readConfig")(function* (tsconfig: string) {
	const parsed = yield* Effect.sync(() => {
		const source = ts.readJsonConfigFile(tsconfig, ts.sys.readFile);
		const config = ts.parseJsonSourceFileConfigFileContent(source, ts.sys, dirname(tsconfig), undefined, tsconfig);
		return { config, problems: config.errors, source };
	});
	if (parsed.problems.length > 0) {
		return yield* new BuildFailure({ message: `${tsconfig} cannot be read:\n${diagnosticText(parsed.problems)}` });
	}
	const config: ProjectConfig = {
		chain: [tsconfig, ...(parsed.source.extendedSourceFiles ?? [])],
		declarations: parsed.config.fileNames.filter((file) => file.endsWith(".d.ts")),
		files: parsed.config.fileNames,
		options: parsed.config.options,
		typeScriptVersion: ts.version,
	};
	return config;
});

export function definesModule(file: string, text: string): boolean {
	return text.includes("defineModule") && moduleCalls(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)).length > 0;
}

export const resolvedImports = Effect.fn("Build.resolvedImports")(function* (config: ProjectConfig, file: string, text: string) {
	return yield* Effect.sync(() =>
		ts.preProcessFile(text, true, true).importedFiles.flatMap(({ fileName }) => {
			const resolved = ts.resolveModuleName(fileName, file, config.options, ts.sys).resolvedModule;
			return resolved === undefined ? [] : [resolved.resolvedFileName];
		}),
	);
});

// Building the program is the expensive part of a run: every module of the project shares one.
export const deriveModules = Effect.fn("Build.deriveModules")(function* (config: ProjectConfig, modules: readonly string[]) {
	return yield* Effect.sync(() => {
		const program = ts.createProgram({ options: { ...config.options, noEmit: true }, rootNames: [...modules, ...config.declarations] });
		return modules.map((module) => moduleFacts(program, module));
	});
});
