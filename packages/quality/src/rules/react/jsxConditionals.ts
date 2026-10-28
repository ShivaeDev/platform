import ts from "typescript";
import { defineRule, type Finding } from "#rule.ts";
import { parse } from "#rules/parse.ts";

const REPAIR =
	"Decide before the JSX with an if and early return, or a variable computed above the return; or extract a component that receives the data and returns null when it has nothing to show.";

function mapCall(node: ts.Node): boolean {
	return ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "map";
}

function childContext(node: ts.Node): { readonly mapped: boolean } | undefined {
	let mapped = false;
	let child = false;
	for (let parent = node.parent; parent !== undefined; parent = parent.parent) {
		if (ts.isJsxExpression(parent)) {
			if (!(child || ts.isJsxElement(parent.parent) || ts.isJsxFragment(parent.parent))) {
				return undefined;
			}
			child = true;
		}
		if (ts.isVariableDeclaration(parent) || (ts.isStatement(parent) && !ts.isReturnStatement(parent) && !ts.isBlock(parent))) {
			break;
		}
		mapped ||= mapCall(parent);
	}
	return child ? { mapped } : undefined;
}

export const jsxConditionals = defineRule({
	check: ({ sources }) =>
		sources.flatMap((file) => {
			const source = parse(file);
			const findings: Finding[] = [];
			function visit(node: ts.Node): void {
				if (ts.isConditionalExpression(node) || (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) {
					const context = childContext(node);
					if (context !== undefined && source !== undefined) {
						findings.push({
							file: file.path,
							line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
							message: `Conditional rendering inside a JSX child. ${REPAIR}${context.mapped ? " Inside .map, extract the item into its own component that makes its own decision." : ""}`,
						});
					}
				}
				ts.forEachChild(node, visit);
			}
			if (source !== undefined) {
				visit(source);
			}
			return findings;
		}),
	description: `Components decide what to render outside their JSX. ${REPAIR} Inside .map, extract an item component that makes its own decision. Attribute values are accepted.`,
	id: "react/jsx-conditionals",
	registrable: false,
});
