import ts from "typescript";
import { importGraph } from "#imports/graph.ts";
import { isTestSupport } from "#naming/testName.ts";
import { defineRule } from "#rule.ts";
import { registersTests } from "./registersTests.ts";
import { memberName, nodesWhere, syntaxFindings, unwrapped } from "./syntax.ts";

const MESSAGE =
	"Calls expect in test-support. Return the engine's observed state from the verb and put the expectation in the spec; throw if an action cannot run.";

function assertionReference(expression: ts.Expression, names: ReadonlySet<string>): boolean {
	const node = unwrapped(expression);
	if (ts.isIdentifier(node)) {
		return names.has(node.text);
	}
	return (
		memberName(node) === "expect"
		|| ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) && assertionReference(node.expression, names))
	);
}

function assertionsIn(source: ts.SourceFile): readonly ts.Node[] {
	const names = new Set(["expect"]);
	for (const statement of source.statements) {
		const bindings = ts.isImportDeclaration(statement) ? statement.importClause?.namedBindings : undefined;
		if (bindings !== undefined && ts.isNamedImports(bindings)) {
			for (const element of bindings.elements) {
				if ((element.propertyName ?? element.name).text === "expect") {
					names.add(element.name.text);
				}
			}
		}
	}
	return nodesWhere(source, (node) => ts.isCallExpression(node) && assertionReference(node.expression, names));
}

export const noExpect = defineRule({
	check: async (inputs) => {
		const support = inputs.sources.filter((file) => isTestSupport(file.path));
		if (support.length === 0) {
			return [];
		}
		const graph = await importGraph(inputs);
		const imported = new Set(graph.edges.flatMap((edge) => (edge.kind === "import" && edge.to.kind === "file" ? [edge.to.path] : [])));
		return support.flatMap((file) =>
			syntaxFindings(file, (source) => (!imported.has(file.path) && registersTests(source) ? [] : assertionsIn(source)), MESSAGE),
		);
	},
	description: "Test-support performs actions and exposes observations; specs own expectations.",
	id: "tests/no-expect-in-support",
});
