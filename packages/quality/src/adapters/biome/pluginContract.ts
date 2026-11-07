import ts from "typescript";
import type { Syntax } from "#biome/syntax.ts";

function pluginType(node: ts.TypeNode | undefined, { checker }: Syntax): boolean {
	if (node === undefined || !ts.isTypeReferenceNode(node)) {
		return false;
	}
	return (checker.getSymbolAtLocation(node.typeName)?.declarations ?? []).some((declaration) => {
		if (!(ts.isImportSpecifier(declaration) && /^(?:[A-Z]\w*)?Plugin$/u.test((declaration.propertyName ?? declaration.name).text))) {
			return false;
		}
		const module = declaration.parent.parent.parent.moduleSpecifier;
		return ts.isStringLiteral(module) && !/^[.#/]/u.test(module.text);
	});
}

export function pluginContract({ source, checker }: Syntax): boolean {
	if (!/(?:^|\/)adapters\//u.test(source.fileName)) {
		return false;
	}
	const syntax = { checker, source };
	function contract(node: ts.Expression): boolean {
		if (ts.isSatisfiesExpression(node) || ts.isAsExpression(node)) {
			return pluginType(node.type, syntax);
		}
		if (ts.isParenthesizedExpression(node)) {
			return contract(node.expression);
		}
		return (
			ts.isIdentifier(node)
			&& (checker.getSymbolAtLocation(node)?.declarations ?? []).some(
				(declaration) =>
					ts.isVariableDeclaration(declaration)
					&& (pluginType(declaration.type, syntax)
						|| (declaration.initializer !== undefined
							&& ts.isSatisfiesExpression(declaration.initializer)
							&& pluginType(declaration.initializer.type, syntax))),
			)
		);
	}
	return source.statements.some((statement) => ts.isExportAssignment(statement) && !statement.isExportEquals && contract(statement.expression));
}
