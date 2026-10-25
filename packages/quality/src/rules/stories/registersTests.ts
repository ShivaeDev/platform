import ts from "typescript";
import { memberName, unwrapped } from "./syntax.ts";

function vitestBindings(source: ts.SourceFile): ReadonlyMap<string, string> {
	const names = new Map<string, string>();
	for (const statement of source.statements) {
		if (
			!(
				ts.isImportDeclaration(statement)
				&& ts.isStringLiteral(statement.moduleSpecifier)
				&& ["vitest", "@effect/vitest"].includes(statement.moduleSpecifier.text)
			)
		) {
			continue;
		}
		const bindings = statement.importClause?.namedBindings;
		if (bindings !== undefined && ts.isNamedImports(bindings)) {
			for (const element of bindings.elements) {
				names.set(element.name.text, (element.propertyName ?? element.name).text);
			}
		} else if (bindings !== undefined) {
			names.set(bindings.name.text, "namespace");
		}
	}
	return names;
}

function localBindings(source: ts.SourceFile): ReadonlyMap<string, ts.Expression> {
	const bindings = new Map<string, ts.Expression>();
	for (const statement of source.statements) {
		if (ts.isVariableStatement(statement)) {
			for (const declaration of statement.declarationList.declarations) {
				if (ts.isIdentifier(declaration.name) && declaration.initializer !== undefined) {
					bindings.set(declaration.name.text, declaration.initializer);
				}
			}
		}
	}
	return bindings;
}

export function registersTests(source: ts.SourceFile): boolean {
	const bindings = localBindings(source);
	const imports = vitestBindings(source);
	function registrar(expression: ts.Expression, seen = new Set<string>()): boolean {
		const node = unwrapped(expression);
		if (ts.isIdentifier(node)) {
			if (seen.has(node.text)) {
				return false;
			}
			seen.add(node.text);
			const binding = bindings.get(node.text);
			return ["it", "test", "describe"].includes(imports.get(node.text) ?? node.text) || (binding !== undefined && registrar(binding, seen));
		}
		if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
			const name = memberName(node);
			return (
				name === "it"
				|| (ts.isIdentifier(node.expression) && imports.get(node.expression.text) === "namespace" && (name === "test" || name === "describe"))
				|| registrar(node.expression, seen)
			);
		}
		return ts.isCallExpression(node) && registrar(node.expression, seen);
	}
	return source.statements.some((statement) => {
		if (!ts.isExpressionStatement(statement)) {
			return false;
		}
		const call = unwrapped(statement.expression);
		const title = ts.isCallExpression(call) ? call.arguments[0] : undefined;
		return (
			ts.isCallExpression(call)
			&& title !== undefined
			&& (ts.isStringLiteralLike(title) || ts.isTemplateExpression(title))
			&& registrar(call.expression)
		);
	});
}
