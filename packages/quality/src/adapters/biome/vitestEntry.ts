import ts from "typescript";
import type { Syntax } from "#biome/syntax.ts";

const ENTRIES = new Set(["it", "test", "beforeAll", "beforeEach", "afterAll", "afterEach"]);
const MODIFIERS = new Set(["only", "skip", "skipIf", "runIf", "concurrent", "sequential", "fails", "each"]);

function moduleOf(node: ts.Node): string | undefined {
	for (let parent: ts.Node | undefined = node; parent !== undefined; parent = parent.parent) {
		if (ts.isImportDeclaration(parent) && ts.isStringLiteral(parent.moduleSpecifier)) {
			return parent.moduleSpecifier.text;
		}
	}
	return undefined;
}

export function vitestEntry(expression: ts.Expression, { checker }: Syntax): boolean {
	if (ts.isCallExpression(expression)) {
		return vitestEntry(expression.expression, { checker, source: expression.getSourceFile() });
	}
	if (ts.isPropertyAccessExpression(expression)) {
		if (MODIFIERS.has(expression.name.text)) {
			return vitestEntry(expression.expression, { checker, source: expression.getSourceFile() });
		}
		const namespace = checker.getSymbolAtLocation(expression.expression);
		return (
			ENTRIES.has(expression.name.text)
			&& (namespace?.declarations ?? []).some((declaration) => ts.isNamespaceImport(declaration) && moduleOf(declaration) === "vitest")
		);
	}
	return (
		ts.isIdentifier(expression)
		&& (checker.getSymbolAtLocation(expression)?.declarations ?? []).some(
			(declaration) =>
				ts.isImportSpecifier(declaration) && ENTRIES.has((declaration.propertyName ?? declaration.name).text) && moduleOf(declaration) === "vitest",
		)
	);
}
