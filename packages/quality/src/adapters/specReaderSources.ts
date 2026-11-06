import ts from "typescript";
import type { SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { topLevelHelpers } from "#rules/stories/syntax.ts";

export function specReaderSources(files: readonly SourceFile[]) {
	const sources = files.flatMap((file) => {
		const source = parse(file);
		return source === undefined || topLevelHelpers(source).length === 0 ? [] : [source];
	});
	if (sources.length === 0) {
		return [];
	}
	const options: ts.CompilerOptions = { allowJs: true, noResolve: true, target: ts.ScriptTarget.ESNext, types: [] };
	const host = ts.createCompilerHost(options);
	const getSourceFile = host.getSourceFile;
	const parsed = new Map(sources.map((source) => [source.fileName, source]));
	host.getSourceFile = (path, ...args) => parsed.get(path) ?? getSourceFile(path, ...args);
	const program = ts.createProgram([...parsed.keys()], options, host);
	const checker = program.getTypeChecker();
	function nativeCall(call: ts.CallExpression): boolean {
		const declaration = checker.getResolvedSignature(call)?.declaration;
		return (
			declaration !== undefined
			&& program.isSourceFileDefaultLibrary(declaration.getSourceFile())
			&& call.arguments.every((argument) => {
				if (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) {
					return true;
				}
				const type = checker.getTypeAtLocation(argument);
				return (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) === 0 && type.getCallSignatures().length === 0;
			})
		);
	}
	return sources.map((source) => ({ nativeCall, source }));
}
