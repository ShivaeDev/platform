import ts from "typescript";
import { defineRule, type Finding } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { jsxChildDecision } from "./jsxChildDecision.ts";

const REPAIR =
	"Decide before the JSX with an if and early return, or a variable computed above the return; or extract a component that receives the data and returns null when it has nothing to show.";

export const jsxConditionals = defineRule({
	check: ({ sources }) =>
		sources.flatMap((file) => {
			const source = parse(file);
			const findings: Finding[] = [];
			function visit(node: ts.Node): void {
				const context = jsxChildDecision(node);
				if (context !== undefined && source !== undefined) {
					findings.push({
						file: file.path,
						line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
						message: `Conditional rendering inside a JSX child. ${REPAIR}${context.mapped ? " Inside .map, extract the item into its own component that makes its own decision." : ""}`,
					});
				}
				ts.forEachChild(node, visit);
			}
			if (source !== undefined) {
				visit(source);
			}
			return findings;
		}),
	description: `Components decide what to render outside their returned JSX. ${REPAIR} Inside .map, extract an item component that makes its own decision. Attribute values, library callbacks and ternaries between plain string or number literals are accepted.`,
	id: "react/jsx-conditionals",
	registrable: false,
});
