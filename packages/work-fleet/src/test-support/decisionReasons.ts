import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const adapters = [
	"engine/makeObserve.ts",
	"engine/makeAdopt.ts",
	"engine/completeReport.ts",
	"engine/refreshReviewResult.ts",
	"completion.ts",
	"board/reportContent.ts",
	"session/validateReceipt.ts",
	"host/resultReport.ts",
	"host/githubResult.ts",
	"host/github.ts",
	"host/githubDelivery.ts",
	"host/githubChecks.ts",
	"host/movedPrHead.ts",
	"prompt/reviewer.ts",
	"preparation/compatibility.ts",
];
export function decisionReasons(root: string) {
	return [
		...new Set([...adapters, "host/reportBoard.ts"].flatMap((file) => sourceDecisionReasons(file, readFileSync(join(root, file), "utf8")))),
	].sort((left, right) => left.localeCompare(right));
}
export function sourceDecisionReasons(file: string, source: string) {
	const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
	const reasons: string[] = [];
	function literals(node: ts.Node) {
		if (ts.isStringLiteral(node)) {
			reasons.push(node.text);
		} else {
			ts.forEachChild(node, literals);
		}
	}
	function visit(node: ts.Node) {
		if (file === "host/reportBoard.ts" && ts.isFunctionDeclaration(node) && node.parent === tree && node.name?.text !== "reportBoard") {
			return;
		}
		if (
			ts.isVariableDeclaration(node)
			&& ["MOVED_PR_HEAD_REASON", "PUBLISHED_REPORT"].includes(node.name.getText(tree))
			&& node.initializer !== undefined
		) {
			literals(node.initializer);
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
		ts.forEachChild(node, visit);
	}
	visit(tree);
	return reasons;
}
