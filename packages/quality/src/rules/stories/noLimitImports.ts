import ts from "typescript";
import { defineRule } from "#rule.ts";
import { isSpec, memberName, nodesWhere, syntaxFindings } from "./syntax.ts";

const MESSAGE =
	"Imports a MAX_* constant from a limits module. Tell a story about the observed behavior instead of asserting a copy of the implementation's cap.";

const LIMITS_MODULE = /(?:^|[/#])limits(?:\.[cm]?[jt]s)?(?:\/|$)/u;
const MAX_CONSTANT = /^MAX_/u;

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
	return [
		...imports,
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
