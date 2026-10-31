import ts from "typescript";
import { effectName, type FailureOperation, failureOperations, fileSystemCall } from "./failureOperations.ts";
import { successRecovery } from "./successRecovery.ts";

interface FailureFinding {
	readonly message: string;
	readonly node: ts.Node;
}

function unboundedRetry(node: ts.CallExpression): boolean {
	const options = node.arguments.at(-1);
	if (options === undefined || !ts.isObjectLiteralExpression(options)) {
		return false;
	}
	const names = options.properties.flatMap((property) => (property.name === undefined ? [] : [property.name.getText().replaceAll(/["']/gu, "")]));
	return names.includes("while") && !names.includes("times") && !names.includes("schedule") && !options.properties.some(ts.isSpreadAssignment);
}

function operationFailure(checker: ts.TypeChecker, operation: FailureOperation, before: readonly FailureOperation[]): string | undefined {
	if (["option", "orElseSucceed"].includes(operation.name) && before.some((part) => fileSystemCall(checker, part.node))) {
		return "FileSystem failure becomes absence or success. Catch a named reason such as NotFound, re-fail other errors, or return an explicit unavailable state.";
	}
	if (/^fork(?:Scoped|In|Detach|Daemon|Child)?$/u.test(operation.name)) {
		const names = before.map((part) => part.name);
		const forever = names.indexOf("forever");
		if (forever !== -1 && names.indexOf("orDie", forever + 1) !== -1) {
			return "Forked forever loop dies on failure. Catch a named reason within each iteration with a Schedule-bounded retry, or expose an explicit unavailable state and supervise termination.";
		}
	}
	return undefined;
}

export function failureFindings(checker: ts.TypeChecker, node: ts.CallExpression): readonly FailureFinding[] {
	const findings: FailureFinding[] = [];
	const name = effectName(checker, node.expression);
	if (name === "retry" && unboundedRetry(node)) {
		findings.push({ message: "Retry has while without times or schedule. Use a Schedule-bounded retry and preserve the final typed failure.", node });
	}
	const handler = node.arguments.at(-1);
	if (["catch", "catchAll", "catchCause", "catchAllCause"].includes(name ?? "") && handler !== undefined && successRecovery(checker, handler)) {
		findings.push({
			message:
				"Catch turns every failure into success. Catch a named reason with catchTag or catchIf and re-fail the rest, or model an explicit unavailable state.",
			node,
		});
	}
	const operations = failureOperations(checker, node);
	for (const [index, operation] of operations.entries()) {
		const message = operationFailure(checker, operation, operations.slice(0, index));
		if (message !== undefined) {
			findings.push({ message, node: operation.node });
		}
	}
	return findings;
}
