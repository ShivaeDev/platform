import ts from "typescript";
import type { ImportBinding } from "#rules/stories/importBindings.ts";
import { memberName, unwrapped } from "#rules/stories/syntax.ts";
import { rejectingTimer } from "./failureDeadline.ts";

const TIMERS = new Set(["setTimeout", "setInterval", "requestAnimationFrame"]);
const TIMER_MODULES = new Set(["node:timers", "timers", "node:timers/promises", "timers/promises"]);

function globalName(expression: ts.Expression): string | undefined {
	const value = unwrapped(expression);
	if (ts.isIdentifier(value)) {
		return value.text;
	}
	if (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value)) {
		const receiver = globalName(value.expression);
		return receiver === "globalThis" || receiver === "window" || receiver === "global" ? memberName(value) : undefined;
	}
	return undefined;
}

export function realTime(call: ts.CallExpression | ts.NewExpression, bindings: ReadonlyMap<string, ImportBinding>): boolean {
	const callee = unwrapped(call.expression);
	const name = globalName(callee);
	if (name === "Date") {
		return !ts.isNewExpression(call) || (call.arguments?.length ?? 0) === 0;
	}
	if (ts.isNewExpression(call)) {
		return false;
	}
	if (name !== undefined && TIMERS.has(name)) {
		return name !== "setTimeout" || !rejectingTimer(call);
	}
	if (ts.isIdentifier(callee)) {
		const binding = bindings.get(callee.text);
		return binding !== undefined && TIMER_MODULES.has(binding.module) && TIMERS.has(binding.imported) && !rejectingTimer(call);
	}
	if (!(ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee))) {
		return false;
	}
	return timedMember(call, callee, bindings);
}

function bindingOf(expression: ts.Expression, bindings: ReadonlyMap<string, ImportBinding>): ImportBinding | undefined {
	const value = unwrapped(expression);
	if (ts.isIdentifier(value)) {
		return bindings.get(value.text);
	}
	return ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value) ? bindingOf(value.expression, bindings) : undefined;
}

function timedMember(
	call: ts.CallExpression,
	callee: ts.PropertyAccessExpression | ts.ElementAccessExpression,
	bindings: ReadonlyMap<string, ImportBinding>,
): boolean {
	const receiver = unwrapped(callee.expression);
	const member = memberName(callee);
	const owner = globalName(receiver);
	if ((owner === "Date" || owner === "performance") && member === "now") {
		return true;
	}
	const binding = bindingOf(receiver, bindings);
	if (binding !== undefined && TIMER_MODULES.has(binding.module)) {
		return (
			(TIMERS.has(member ?? "") && !rejectingTimer(call))
			|| ((binding.imported === "scheduler" || memberName(receiver) === "scheduler") && member === "wait")
		);
	}
	if (binding?.module === "node:perf_hooks" || binding?.module === "perf_hooks") {
		return member === "now";
	}
	if (owner === "process" || binding?.module === "node:process") {
		return member === "hrtime";
	}
	return member === "bigint" && memberName(receiver) === "hrtime";
}
