import ts from "typescript";
import { bindsModule, type ImportBinding } from "#rules/stories/importBindings.ts";
import { memberName, unwrapped } from "#rules/stories/syntax.ts";

export function eventConsumption(node: ts.Node, bindings: ReadonlyMap<string, ImportBinding>): boolean {
	if (ts.isCallExpression(node)) {
		const callee = unwrapped(node.expression);
		if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
			const binding = bindings.get(callee.expression.text);
			const member = memberName(callee);
			if (
				(member === "take" && bindsModule(binding, "Queue", ["effect"]))
				|| (member === "await" && bindsModule(binding, "Deferred", ["effect"]))
				|| (member === "runCollect" && bindsModule(binding, "Stream", ["effect"]))
			) {
				return true;
			}
		}
	}
	return ts.forEachChild(node, (child) => eventConsumption(child, bindings)) === true;
}

export function repeatedEventConsumption(call: ts.CallExpression, bindings: ReadonlyMap<string, ImportBinding>): boolean {
	if (eventConsumption(call, bindings)) {
		return true;
	}
	const parent = call.parent;
	return (
		ts.isCallExpression(parent)
		&& parent.arguments.includes(call)
		&& ts.isPropertyAccessExpression(parent.expression)
		&& parent.expression.name.text === "pipe"
		&& eventConsumption(parent.expression.expression, bindings)
	);
}
