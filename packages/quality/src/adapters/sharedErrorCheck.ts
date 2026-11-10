import { Effect } from "effect";
import ts from "typescript";
import { type SharedErrorModule, sharedErrorModules } from "#adapters/sharedErrorModules.ts";
import { filesProgram } from "#adapters/typeScriptProgram.ts";
import type { Finding, RuleInputs, SourceFile, TypeScriptProgram } from "#rule.ts";

interface SharedError {
	readonly declaration: string | undefined;
	readonly repair: string;
}

// The shared classes come from their own program, so a scanned class is the shared one when it is declared at the same place.
function declarationOf(symbol: ts.Symbol): string | undefined {
	const declaration = symbol.valueDeclaration;
	return declaration === undefined ? undefined : `${declaration.getSourceFile().fileName}:${declaration.pos}`;
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

function sharedCatalog({ checker, program }: TypeScriptProgram, modules: readonly SharedErrorModule[]): ReadonlyMap<string, SharedError> {
	const catalog = new Map<string, SharedError>();
	for (const { file, specifier } of modules) {
		const source = program.getSourceFile(file);
		const module = source === undefined ? undefined : checker.getSymbolAtLocation(source);
		for (const exported of module === undefined ? [] : checker.getExportsOfModule(module)) {
			const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
			const tag = errorTag(checker, symbol);
			if (tag !== undefined) {
				catalog.set(tag, { declaration: declarationOf(symbol), repair: `Import ${exported.name} from "${specifier}" and use that class instead.` });
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
			if (shared !== undefined && symbol !== undefined && declarationOf(symbol) !== shared.declaration) {
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

function declaresClasses(source: SourceFile): boolean {
	return /\.[cm]?[jt]sx?$/u.test(source.path) && /\bclass\b/u.test(source.text);
}

export const sharedErrorCheck = Effect.fn("SharedErrorClasses.sharedErrorCheck")(function* (inputs: RuleInputs) {
	const sources = inputs.sources.filter(declaresClasses);
	const modules = sources.length === 0 ? [] : yield* sharedErrorModules({ ...inputs, sources });
	const catalog =
		modules.length === 0
			? new Map<string, SharedError>()
			: sharedCatalog(
					yield* filesProgram(
						inputs.root,
						modules.map(({ file }) => file),
					),
					modules,
				);
	return {
		checks: (source: SourceFile) => catalog.size > 0 && declaresClasses(source),
		findings: (files: readonly SourceFile[], { checker, sourceFile }: TypeScriptProgram) =>
			files.flatMap((file) => {
				const source = sourceFile(file.path);
				return source === undefined ? [] : classFindings(source, file.path, checker, catalog);
			}),
	};
});
