import ts from "typescript";
import { bindsModule, type ImportBinding } from "./importBindings.ts";
import { memberName, unwrapped } from "./syntax.ts";

function terminal(body: ts.ConciseBody): ts.Expression | undefined {
	if (!ts.isBlock(body)) {
		return unwrapped(body);
	}
	const last = body.statements.at(-1);
	return last !== undefined && (ts.isReturnStatement(last) || ts.isExpressionStatement(last)) ? last.expression : undefined;
}

function fails(expression: ts.Expression, bindings: ReadonlyMap<string, ImportBinding>): boolean {
	const value = unwrapped(expression);
	if (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) {
		const result = terminal(value.body);
		return result !== undefined && fails(result, bindings);
	}
	if (!(ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression))) {
		return false;
	}
	const receiver = value.expression.expression;
	return (
		ts.isIdentifier(receiver)
		&& bindsModule(bindings.get(receiver.text), "Effect", ["effect"])
		&& ["die", "fail"].includes(value.expression.name.text)
	);
}

export function failingSleep(call: ts.CallExpression, bindings: ReadonlyMap<string, ImportBinding>): boolean {
	const access = call.parent;
	const pipe = access.parent;
	if (!(ts.isPropertyAccessExpression(access) && access.name.text === "pipe" && ts.isCallExpression(pipe) && pipe.arguments.length === 1)) {
		return false;
	}
	const step = pipe.arguments[0];
	if (step === undefined || !ts.isCallExpression(step) || memberName(step.expression) !== "andThen") {
		return false;
	}
	const receiver = ts.isPropertyAccessExpression(step.expression) ? step.expression.expression : undefined;
	return (
		receiver !== undefined
		&& ts.isIdentifier(receiver)
		&& bindsModule(bindings.get(receiver.text), "Effect", ["effect"])
		&& step.arguments.length === 1
		&& step.arguments[0] !== undefined
		&& fails(step.arguments[0], bindings)
	);
}

function rejectionName(call: ts.CallExpression): string | undefined {
	for (let node: ts.Node | undefined = call.parent; node !== undefined; node = node.parent) {
		if (
			(ts.isArrowFunction(node) || ts.isFunctionExpression(node))
			&& ts.isNewExpression(node.parent)
			&& ts.isIdentifier(node.parent.expression)
			&& node.parent.expression.text === "Promise"
		) {
			const name = node.parameters[1]?.name;
			return name !== undefined && ts.isIdentifier(name) ? name.text : undefined;
		}
	}
	return undefined;
}

export function rejectingTimer(call: ts.CallExpression): boolean {
	const reject = rejectionName(call);
	const callback = call.arguments[0];
	if (reject === undefined || callback === undefined) {
		return false;
	}
	const body = ts.isArrowFunction(callback) || ts.isFunctionExpression(callback) ? terminal(callback.body) : callback;
	return (
		body !== undefined
		&& ((ts.isIdentifier(body) && body.text === reject)
			|| (ts.isCallExpression(body) && ts.isIdentifier(body.expression) && body.expression.text === reject))
	);
}
