import ts from "typescript";
import type { ImportEdge } from "#imports/graph.ts";
import type { SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";

export function pureNetImport(edge: ImportEdge, source: SourceFile | undefined): boolean {
	if (edge.specifier !== "node:net" || source === undefined) {
		return false;
	}
	const syntax = parse(source);
	return (
		syntax?.statements.some((statement) => {
			if (!(ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) || statement.moduleSpecifier.text !== "node:net") {
				return false;
			}
			if (syntax.getLineAndCharacterOfPosition(statement.moduleSpecifier.getStart(syntax)).line + 1 !== edge.line) {
				return false;
			}
			const clause = statement.importClause;
			const bindings = clause?.namedBindings;
			return (
				clause?.name === undefined
				&& bindings !== undefined
				&& ts.isNamedImports(bindings)
				&& bindings.elements.every((binding) => binding.isTypeOnly || ["BlockList", "isIP"].includes((binding.propertyName ?? binding.name).text))
			);
		}) ?? false
	);
}
