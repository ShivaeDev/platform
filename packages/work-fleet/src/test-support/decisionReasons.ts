import ts from "typescript";
import { decisionFactoryReasons } from "./decisionFactoryReasons.ts";
import { decisionFlow } from "./decisionFlow.ts";
import { decisionGraph } from "./decisionGraph.ts";
import { decisionMessageFactories } from "./decisionMessageFactories.ts";
import { decisionSources } from "./decisionSources.ts";
import { decisionSymbol } from "./decisionSymbol.ts";

export function decisionReasons(root: string, sources: Readonly<Record<string, string>> = {}) {
	const { checker, trees } = decisionSources(root, sources);
	const reachable = decisionGraph(checker, trees);
	return [...new Set([...trees.flatMap((tree) => treeDecisionReasons(tree, reachable, checker)), ...decisionFactoryReasons(checker, trees)])].sort(
		(left, right) => left.localeCompare(right),
	);
}
export function sourceDecisionReasons(file: string, source: string) {
	const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
	return treeDecisionReasons(tree);
}

function treeDecisionReasons(tree: ts.SourceFile, reachable?: ReadonlySet<ts.Node>, checker?: ts.TypeChecker) {
	const constants = stringConstants(tree);
	const factories = decisionMessageFactories(tree);
	const reasons: string[] = [];
	function literals(node: ts.Node) {
		const constant = ts.isIdentifier(node) ? constants.get(node.text) : undefined;
		if (ts.isStringLiteralLike(node)) {
			if (
				node.text.includes("quota")
				&& ts.isPropertyAssignment(node.parent)
				&& ts.isObjectLiteralExpression(node.parent.parent)
				&& ts.isNewExpression(node.parent.parent.parent)
				&& node.parent.parent.parent.expression.getText() === "Forbidden"
			) {
				return;
			}
			reasons.push(node.text);
		} else if (ts.isConditionalExpression(node)) {
			literals(node.whenTrue);
			literals(node.whenFalse);
		} else if (constant !== undefined) {
			reasons.push(constant);
		}
	}
	function factoryArguments(node: ts.CallExpression) {
		const symbol = checker === undefined ? undefined : decisionSymbol(checker, node.expression);
		const declaration = symbol?.declarations?.find(ts.isFunctionDeclaration);
		const indices =
			declaration?.name === undefined
				? (factories.get(node.expression.getText(tree)) ?? [])
				: (decisionMessageFactories(declaration.getSourceFile()).get(declaration.name.text) ?? []);
		for (const index of indices) {
			const argument = node.arguments[index];
			if (argument !== undefined) {
				literals(argument);
			}
		}
	}
	function visit(node: ts.Node) {
		if (reachable !== undefined && !reachable.has(node)) {
			for (const child of decisionFlow(node)) {
				visit(child);
			}
			return;
		}
		const message = messageInitializer(node, tree);
		if (message !== undefined) {
			literals(message);
		}

		if (ts.isCallExpression(node)) {
			factoryArguments(node);
		}
		for (const child of decisionFlow(node)) {
			visit(child);
		}
	}
	visit(tree);
	return reasons;
}

function messageInitializer(node: ts.Node, tree: ts.SourceFile) {
	if (!ts.isPropertyAssignment(node)) {
		return undefined;
	}
	if (tree.fileName.endsWith("preparation/compatibility.ts") && node.name.getText(tree) === "reason") {
		return node.initializer;
	}
	return node.name.getText(tree) === "message"
		&& ts.isObjectLiteralExpression(node.parent)
		&& ts.isNewExpression(node.parent.parent)
		&& /^(?:BoardFailure|SessionFailure|BadRequest|Conflict|Forbidden|NotFound|ServiceUnavailable)$/u.test(node.parent.parent.expression.getText())
		? node.initializer
		: undefined;
}

function stringConstants(tree: ts.SourceFile) {
	const constants = new Map<string, string>();
	function visit(node: ts.Node) {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined && ts.isStringLiteral(node.initializer)) {
			constants.set(node.name.text, node.initializer.text);
		}
		for (const child of decisionFlow(node)) {
			visit(child);
		}
	}
	visit(tree);
	return constants;
}
