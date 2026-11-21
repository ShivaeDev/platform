import ts from "typescript";
import { importFrom } from "#rules/stories/importOrigin.ts";
import { unwrapped } from "#rules/stories/syntax.ts";

const MATCHERS = new Set(["any", "anything", "arrayContaining", "objectContaining", "stringContaining", "stringMatching"]);

function importedExpect(node: ts.Expression, checker: ts.TypeChecker): boolean {
	const value = unwrapped(node);
	if (ts.isPropertyAccessExpression(value) && value.name.text === "not") {
		return importedExpect(value.expression, checker);
	}
	const namespace = ts.isPropertyAccessExpression(value) && value.name.text === "expect";
	const receiver = namespace ? value.expression : value;
	if (!ts.isIdentifier(receiver)) {
		return false;
	}
	return (
		checker.getSymbolAtLocation(receiver)?.declarations?.some((declaration) => {
			const from = importFrom(declaration);
			return (
				(from === "vitest" || from === "@effect/vitest")
				&& (namespace
					? ts.isNamespaceImport(declaration)
					: ts.isImportSpecifier(declaration) && (declaration.propertyName ?? declaration.name).text === "expect")
			);
		}) === true
	);
}

export function asymmetricMatcher(call: ts.CallExpression, checker: ts.TypeChecker): boolean {
	const target = unwrapped(call.expression);
	return ts.isPropertyAccessExpression(target) && MATCHERS.has(target.name.text) && importedExpect(target.expression, checker);
}
