import ts from "typescript";
import { type FakeModule, fakeTargets } from "#adapters/imports/fakeTargets.ts";
import type { RuleInputs } from "#rule.ts";
import { parse } from "#rules/parse.ts";

export function mockEntries(inputs: RuleInputs): readonly string[] {
	const modules: FakeModule[] = [];
	for (const file of inputs.sources) {
		const source = /\bvi\s*\.\s*(?:mock|doMock)\b/u.test(file.text) ? parse(file) : undefined;
		if (source === undefined) {
			continue;
		}
		const syntax = source;
		function visit(node: ts.Node): void {
			if (
				ts.isCallExpression(node)
				&& ts.isPropertyAccessExpression(node.expression)
				&& node.expression.expression.getText(syntax) === "vi"
				&& ["mock", "doMock"].includes(node.expression.name.text)
			) {
				const argument = node.arguments[0];
				if (argument !== undefined && ts.isStringLiteralLike(argument)) {
					modules.push({ file: file.path, line: syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line + 1, specifier: argument.text });
				}
			}
			ts.forEachChild(node, visit);
		}
		visit(source);
	}
	return fakeTargets(inputs, modules).map(({ target }) => target);
}
