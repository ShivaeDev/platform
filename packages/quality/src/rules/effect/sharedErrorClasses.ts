import { join } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { type SharedErrorModule, sharedErrorModules } from "#adapters/sharedErrorModules.ts";
import { defineRule, type Finding, type RuleInputs } from "#rule.ts";
import { effectProgram } from "./program.ts";

interface SharedError {
	readonly repair: string;
	readonly symbol: ts.Symbol;
}

function errorTag(checker: ts.TypeChecker, symbol: ts.Symbol): string | undefined {
	if (!(symbol.flags & ts.SymbolFlags.Class)) {
		return undefined;
	}
	const type = checker.getDeclaredTypeOfSymbol(symbol);
	const tag = type.getProperty("_tag");
	const declaration = symbol.valueDeclaration;
	if (tag === undefined || declaration === undefined || type.getProperty("message") === undefined || type.getProperty("name") === undefined) {
		return undefined;
	}
	const literal = checker.getTypeOfSymbolAtLocation(tag, declaration);
	return literal.isStringLiteral() ? literal.value : undefined;
}

function sharedCatalog(program: ts.Program, checker: ts.TypeChecker, modules: readonly SharedErrorModule[]): ReadonlyMap<string, SharedError> {
	const catalog = new Map<string, SharedError>();
	for (const { file, specifier } of modules) {
		const source = program.getSourceFile(file);
		const module = source === undefined ? undefined : checker.getSymbolAtLocation(source);
		for (const exported of module === undefined ? [] : checker.getExportsOfModule(module)) {
			const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
			const tag = errorTag(checker, symbol);
			if (tag !== undefined) {
				catalog.set(tag, { repair: `Import ${exported.name} from "${specifier}" and use that class instead.`, symbol });
			}
		}
	}
	return catalog;
}

function classFindings(source: ts.SourceFile, file: string, checker: ts.TypeChecker, catalog: ReadonlyMap<string, SharedError>): readonly Finding[] {
	const findings: Finding[] = [];
	function visit(node: ts.Node): void {
		if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
			const symbol = checker.getTypeAtLocation(node).symbol;
			const tag = symbol === undefined ? undefined : errorTag(checker, symbol);
			const shared = tag === undefined ? undefined : catalog.get(tag);
			if (shared !== undefined && symbol !== shared.symbol) {
				findings.push({
					file,
					line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
					message: `Tagged error ${node.name?.text ?? "anonymous class"} reuses the shared tag "${tag}". ${shared.repair}`,
				});
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return findings;
}

export const sharedErrorClasses = defineRule({
	check: Effect.fn("SharedErrorClasses.check")(function* (inputs: RuleInputs) {
		const sources = inputs.sources.filter((source) => /\.[cm]?[jt]sx?$/u.test(source.path) && /\bclass\b/u.test(source.text));
		if (sources.length === 0) {
			return [];
		}
		const modules = yield* Effect.promise(() => sharedErrorModules({ ...inputs, sources }));
		if (modules.length === 0) {
			return [];
		}
		const program = effectProgram(
			{ ...inputs, sources },
			true,
			modules.map(({ file }) => file),
		);
		const checker = program.getTypeChecker();
		const catalog = sharedCatalog(program, checker, modules);
		return sources.flatMap((file) => {
			const source = program.getSourceFile(join(inputs.root, file.path));
			return source === undefined ? [] : classFindings(source, file.path, checker, catalog);
		});
	}),
	description:
		"A tagged error with a tag exported by @shivaedev/errors must use that exported class. Import the shared class instead of declaring another error or subclass with its tag.",
	id: "effect/shared-error-classes",
	registrable: false,
});
