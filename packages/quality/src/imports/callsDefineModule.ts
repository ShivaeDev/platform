import ts from "typescript";
import type { SourceFile } from "#rule.ts";
import { parse } from "#rules/parse.ts";

const DEFINE_MODULE = "@shivaedev/contract/defineModule.ts";

function definers(source: ts.SourceFile): ReadonlySet<string> {
	return new Set(
		source.statements.filter(ts.isImportDeclaration).flatMap((statement) => {
			const clause = statement.importClause;
			const bindings = clause?.namedBindings;
			if (
				clause === undefined
				|| clause.isTypeOnly
				|| bindings === undefined
				|| !ts.isNamedImports(bindings)
				|| !(ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === DEFINE_MODULE)
			) {
				return [];
			}
			return bindings.elements
				.filter((element) => !element.isTypeOnly && (element.propertyName ?? element.name).text === "defineModule")
				.map((element) => element.name.text);
		}),
	);
}

export function callsDefineModule(file: SourceFile): boolean {
	const source = file.text.includes("defineModule") ? parse(file) : undefined;
	const names = source === undefined ? new Set<string>() : definers(source);
	if (source === undefined || names.size === 0) {
		return false;
	}
	let found = false;
	function visit(node: ts.Node): void {
		found ||= ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text);
		if (!found) {
			ts.forEachChild(node, visit);
		}
	}
	visit(source);
	return found;
}
