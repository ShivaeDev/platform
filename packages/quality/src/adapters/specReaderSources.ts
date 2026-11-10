import { Effect } from "effect";
import ts from "typescript";
import { asymmetricMatcher } from "#adapters/asymmetricMatcher.ts";
import { DeclarationFiles } from "#adapters/declaration-files/service.ts";
import type { SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { topLevelHelpers, unwrapped } from "#rules/stories/syntax.ts";

const READ_METHODS = new Set([
	"at",
	"concat",
	"endsWith",
	"entries",
	"every",
	"filter",
	"find",
	"findIndex",
	"flat",
	"flatMap",
	"get",
	"has",
	"includes",
	"indexOf",
	"join",
	"keys",
	"lastIndexOf",
	"map",
	"match",
	"reduce",
	"replace",
	"slice",
	"some",
	"split",
	"startsWith",
	"substring",
	"toLowerCase",
	"toUpperCase",
	"trim",
	"values",
]);

export const specReaderSources = Effect.fn("SpecHelpers.specReaderSources")(function* (files: readonly SourceFile[]) {
	const sources = files.flatMap((file) => {
		const source = parse(file);
		return source === undefined || topLevelHelpers(source).length === 0 ? [] : [source];
	});
	if (sources.length === 0) {
		return [];
	}
	const options: ts.CompilerOptions = { allowJs: true, noResolve: true, target: ts.ScriptTarget.ESNext, types: [] };
	const host = ts.createCompilerHost(options);
	const declarations = yield* DeclarationFiles;
	const getSourceFile = yield* declarations.reader(host, options);
	const parsed = new Map(sources.map((source) => [source.fileName, source]));
	host.getSourceFile = (path, ...args) => parsed.get(path) ?? getSourceFile(path, ...args);
	const program = ts.createProgram([...parsed.keys()], options, host);
	const checker = program.getTypeChecker();
	function readCall(call: ts.CallExpression): boolean {
		if (asymmetricMatcher(call, checker)) {
			return true;
		}
		const target = unwrapped(call.expression);
		if (!(ts.isPropertyAccessExpression(target) && READ_METHODS.has(target.name.text))) {
			return false;
		}
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
	return sources.map((source) => ({ readCall, source }));
});
