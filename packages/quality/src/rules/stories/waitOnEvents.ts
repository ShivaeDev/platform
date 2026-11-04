import { Effect } from "effect";
import ts from "typescript";
import { isTestSupport } from "#naming/testName.ts";
import { defineRule } from "#rule.ts";
import { bindsModule, type ImportBinding, importBindings } from "./importBindings.ts";
import { storyWaitSources } from "./sources.ts";
import { memberName, syntaxFindings, unwrapped } from "./syntax.ts";

const MESSAGE =
	"Waits on time in a story or reachable test-support: a sleep, a timer, polling with eventually or waitFor, fake timers or a clock adjustment in the spec. Settle on the engine's own signal through a kit verb, such as a Deferred the engine completes, story.runUntil or screenDriver's settle(). A deadline bounds a failure but does not prove completion; reaching it must fail the story. When time passing is the behaviour, name it in a kit verb that advances TestClock.";

const TIMERS = new Set(["setInterval", "setTimeout"]);
const VI_TIMING = /^(?:useFakeTimers|advanceTimers\w*|runAllTimers\w*|runOnlyPendingTimers\w*|runAllTicks|setSystemTime|waitFor|waitUntil)$/u;
const CLOCK_CHANGES = new Set(["adjust", "setTime"]);

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

function failingSleep(call: ts.CallExpression, bindings: ReadonlyMap<string, ImportBinding>): boolean {
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

function rejectingTimer(call: ts.CallExpression): boolean {
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

function receiverOf(callee: ts.Expression): ts.Identifier | undefined {
	const receiver = ts.isPropertyAccessExpression(callee) ? unwrapped(callee.expression) : undefined;
	return receiver !== undefined && ts.isIdentifier(receiver) ? receiver : undefined;
}

function vitestTiming(receiver: ts.Identifier, bindings: ReadonlyMap<string, ImportBinding>): boolean {
	const binding = bindings.get(receiver.text);
	return binding === undefined ? receiver.text === "vi" : bindsModule(binding, "vi", ["vitest", "@effect/vitest"]);
}

function timedWait(call: ts.CallExpression, bindings: ReadonlyMap<string, ImportBinding>, support: boolean): boolean {
	const callee = unwrapped(call.expression);
	if (ts.isIdentifier(callee)) {
		return (
			(TIMERS.has(callee.text) && !(callee.text === "setTimeout" && rejectingTimer(call))) || bindings.get(callee.text)?.imported === "eventually"
		);
	}
	const member = memberName(callee) ?? "";
	const receiver = receiverOf(callee);
	if (receiver === undefined) {
		return false;
	}
	const binding = bindings.get(receiver.text);
	return (
		(member === "sleep" && bindsModule(binding, "Effect", ["effect"]) && !failingSleep(call, bindings))
		|| (VI_TIMING.test(member) && vitestTiming(receiver, bindings))
		|| (!support && CLOCK_CHANGES.has(member) && bindsModule(binding, "TestClock", ["effect/testing"]))
		|| (TIMERS.has(member) && receiver.text === "globalThis" && !(member === "setTimeout" && rejectingTimer(call)))
	);
}

function timedWaits(source: ts.SourceFile): readonly ts.Node[] {
	const bindings = importBindings(source);
	const support = isTestSupport(source.fileName);
	const found: ts.Node[] = [];
	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node) && timedWait(node, bindings, support)) {
			found.push(node);
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return found;
}

export const waitOnEvents = defineRule({
	check: (inputs) => Effect.map(storyWaitSources(inputs), (sources) => sources.flatMap((file) => syntaxFindings(file, timedWaits, MESSAGE))),
	description: "Stories and reachable test-support settle on the engine's own signals; controlled clock advances belong in kit verbs.",
	id: "tests/wait-on-events",
});
