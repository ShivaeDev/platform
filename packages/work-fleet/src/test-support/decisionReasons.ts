import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { decisionMessageFactories } from "./decisionMessageFactories.ts";

const adapters = [
	"engine/makeObserve.ts",
	"engine/makeAdopt.ts",
	"engine/completeReport.ts",
	"engine/refreshReviewResult.ts",
	"engine/repository.ts",
	"completion.ts",
	"board/reportContent.ts",
	"session/validateReceipt.ts",
	"host/resultReport.ts",
	"host/githubResult.ts",
	"host/github.ts",
	"host/githubDelivery.ts",
	"host/githubChecks.ts",
	"host/movedPrHead.ts",
	"host/runtime.ts",
	"host/quota.ts",
	"prompt/reviewer.ts",
	"preparation/compatibility.ts",
];
export function decisionReasons(root: string, sources: Readonly<Record<string, string>> = {}) {
	return [
		...new Set(
			[...adapters, "host/reportBoard.ts"].flatMap((file) => sourceDecisionReasons(file, sources[file] ?? readFileSync(join(root, file), "utf8"))),
		),
	].sort((left, right) => left.localeCompare(right));
}
export function sourceDecisionReasons(file: string, source: string) {
	const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
	const constants = stringConstants(tree);
	const factories = decisionMessageFactories(tree);
	const reasons: string[] = [];
	function literals(node: ts.Node) {
		const constant = ts.isIdentifier(node) ? constants.get(node.text) : undefined;
		if (ts.isStringLiteral(node)) {
			reasons.push(node.text);
		} else if (constant === undefined) {
			ts.forEachChild(node, literals);
		} else {
			reasons.push(constant);
		}
	}
	function factoryArguments(node: ts.CallExpression) {
		for (const index of factories.get(node.expression.getText(tree)) ?? []) {
			const argument = node.arguments[index];
			if (argument !== undefined) {
				literals(argument);
			}
		}
	}
	function visit(node: ts.Node) {
		if (file === "host/reportBoard.ts" && ts.isFunctionDeclaration(node) && node.parent === tree && node.name?.text !== "reportBoard") {
			return;
		}
		if (
			ts.isPropertyAssignment(node)
			&& (node.name.getText(tree) === "message" || (file === "preparation/compatibility.ts" && node.name.getText(tree) === "reason"))
		) {
			literals(node.initializer);
		}
		if (ts.isCallExpression(node) && node.expression.getText(tree) === "failure" && node.arguments[0] !== undefined) {
			literals(node.arguments[0]);
		}
		if (ts.isCallExpression(node)) {
			factoryArguments(node);
		}
		ts.forEachChild(node, visit);
	}
	visit(tree);
	return reasons;
}

function stringConstants(tree: ts.SourceFile) {
	const constants = new Map<string, string>();
	function visit(node: ts.Node) {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined && ts.isStringLiteral(node.initializer)) {
			constants.set(node.name.text, node.initializer.text);
		}
		ts.forEachChild(node, visit);
	}
	visit(tree);
	return constants;
}
