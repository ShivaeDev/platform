import ts from "typescript";
import { defineRule } from "#rule.ts";
import { isSpec, memberName, nodesWhere, syntaxFindings, unwrapped } from "./syntax.ts";

const MESSAGE =
	"Imports a MAX_* constant from a limits module. Tell a story about the observed behavior instead of asserting a copy of the implementation's cap.";

const LIMITS_MODULE = /(?:^|[/#])limits(?:\.[cm]?[jt]s)?(?:\/|$)/u;
const MAX_CONSTANT = /^MAX_/u;

function literalLimitsImport(expression: ts.Expression): boolean {
	const node = unwrapped(expression);
	if (ts.isAwaitExpression(node)) {
		return literalLimitsImport(node.expression);
	}
	return (
		ts.isCallExpression(node)
		&& node.expression.kind === ts.SyntaxKind.ImportKeyword
		&& node.arguments[0] !== undefined
		&& ts.isStringLiteralLike(node.arguments[0])
		&& LIMITS_MODULE.test(node.arguments[0].text)
	);
}

function capBinding(binding: ts.BindingElement): boolean {
	if (binding.dotDotDotToken !== undefined) {
		return false;
	}
	const name = binding.propertyName ?? binding.name;
	if (ts.isComputedPropertyName(name)) {
		return ts.isStringLiteralLike(name.expression) && MAX_CONSTANT.test(name.expression.text);
	}
	return (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) && MAX_CONSTANT.test(name.text);
}

function capImports(source: ts.SourceFile): readonly ts.Node[] {
	const namespaces = new Set<string>();
	const imports = source.statements.flatMap((statement) => {
		if (
			!(ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier) && LIMITS_MODULE.test(statement.moduleSpecifier.text))
		) {
			return [];
		}
		const bindings = statement.importClause?.namedBindings;
		if (bindings !== undefined && ts.isNamespaceImport(bindings)) {
			namespaces.add(bindings.name.text);
		}
		return bindings !== undefined && ts.isNamedImports(bindings)
			? bindings.elements.filter((element) => MAX_CONSTANT.test((element.propertyName ?? element.name).text))
			: [];
	});
	const dynamic = nodesWhere(source, ts.isVariableDeclaration).flatMap<ts.Node>((node) => {
		if (!ts.isVariableDeclaration(node) || node.initializer === undefined || !literalLimitsImport(node.initializer)) {
			return [];
		}
		if (ts.isIdentifier(node.name)) {
			namespaces.add(node.name.text);
			return [];
		}
		return ts.isObjectBindingPattern(node.name) ? node.name.elements.filter(capBinding) : [];
	});
	return [
		...imports,
		...dynamic,
		...nodesWhere(
			source,
			(node) =>
				(ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))
				&& ts.isIdentifier(node.expression)
				&& namespaces.has(node.expression.text)
				&& MAX_CONSTANT.test(memberName(node) ?? ""),
		),
	];
}

export const noLimitImports = defineRule({
	check: ({ sources }) => sources.filter((file) => isSpec(file.path)).flatMap((file) => syntaxFindings(file, capImports, MESSAGE)),
	description: "Stories prove behavior instead of importing implementation caps from limits modules.",
	id: "tests/no-limit-imports",
});
