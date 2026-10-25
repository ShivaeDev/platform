import ts from "typescript";
import { defineRule } from "#rule.ts";
import { isSpec, memberName, nodesWhere, numericValue, syntaxFindings, unwrapped } from "./syntax.ts";

const MESSAGE =
	"Passes a numeric literal or a matcher-only spec-local numeric const to toBe or toHaveLength. Assert the observed items, write the literal where accepted (zero, or a status or exit code), or derive the value from the story's inputs.";

function matcherCall(node: ts.Node): node is ts.CallExpression {
	return ts.isCallExpression(node) && ["toBe", "toHaveLength"].includes(memberName(node.expression) ?? "");
}

function matcherAliases(source: ts.SourceFile): ReadonlySet<ts.Node> {
	const declarations = nodesWhere(
		source,
		(node) =>
			ts.isVariableDeclaration(node)
			&& ts.isIdentifier(node.name)
			&& ts.isVariableDeclarationList(node.parent)
			&& (node.parent.flags & ts.NodeFlags.Const) !== 0
			&& node.initializer !== undefined
			&& numericValue(node.initializer) !== undefined,
	).filter(ts.isVariableDeclaration);
	if (declarations.length === 0) {
		return new Set();
	}
	const options: ts.CompilerOptions = { allowJs: true, noLib: true, noResolve: true, types: [] };
	const host = ts.createCompilerHost(options);
	host.getSourceFile = (path) => (path === source.fileName ? source : undefined);
	const checker = ts.createProgram([source.fileName], options, host).getTypeChecker();
	const aliases = new Map<ts.Symbol, ts.Identifier[]>();
	for (const declaration of declarations) {
		const symbol = checker.getSymbolAtLocation(declaration.name);
		if (symbol !== undefined) {
			aliases.set(symbol, []);
		}
	}
	for (const node of nodesWhere(source, ts.isIdentifier)) {
		if (!ts.isIdentifier(node) || (ts.isVariableDeclaration(node.parent) && node.parent.name === node)) {
			continue;
		}
		const symbol = ts.isShorthandPropertyAssignment(node.parent)
			? checker.getShorthandAssignmentValueSymbol(node.parent)
			: checker.getSymbolAtLocation(node);
		if (symbol !== undefined) {
			aliases.get(symbol)?.push(node);
		}
	}
	return new Set(
		[...aliases.values()]
			.filter((references) => references.every((reference) => matcherCall(reference.parent) && reference.parent.arguments.includes(reference)))
			.flatMap((references) => references.map((reference) => reference.parent)),
	);
}

function codeSubject(expression: ts.Expression): boolean {
	const value = unwrapped(expression);
	if (!(ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value))) {
		return false;
	}
	let root = unwrapped(value.expression);
	while ((ts.isPropertyAccessExpression(root) || ts.isElementAccessExpression(root)) && memberName(root) === "not") {
		root = unwrapped(root.expression);
	}
	if (!ts.isCallExpression(root)) {
		return false;
	}
	const callee = unwrapped(root.expression);
	const receiver = ts.isPropertyAccessExpression(callee) ? unwrapped(callee.expression) : callee;
	const expect = ts.isIdentifier(receiver) && receiver.text === "expect" && (receiver === callee || memberName(callee) === "soft");
	const argument = root.arguments[0];
	if (!expect || argument === undefined) {
		return false;
	}
	const subject = unwrapped(argument);
	return ["status", "code", "exitCode"].includes(ts.isIdentifier(subject) ? subject.text : (memberName(subject) ?? ""));
}

function numericAssertion(node: ts.Node): boolean {
	return (
		matcherCall(node)
		&& !codeSubject(node.expression)
		&& node.arguments.some((argument) => {
			const value = numericValue(argument);
			return value !== undefined && value !== 0;
		})
	);
}

export const namedValues = defineRule({
	check: ({ sources }) =>
		sources
			.filter((file) => isSpec(file.path))
			.flatMap((file) =>
				syntaxFindings(
					file,
					(source) => {
						const aliases = matcherAliases(source);
						return nodesWhere(source, (node) => numericAssertion(node) || aliases.has(node));
					},
					MESSAGE,
				),
			),
	description: "Stories assert observed items or named values instead of bare counts and numbers.",
	id: "tests/named-values",
});
