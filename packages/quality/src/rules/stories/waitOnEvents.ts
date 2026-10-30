import { Effect } from "effect";
import ts from "typescript";
import { defineRule } from "#rule.ts";
import { bindsModule, type ImportBinding, importBindings } from "./importBindings.ts";
import { storySources } from "./sources.ts";
import { memberName, syntaxFindings, unwrapped } from "./syntax.ts";

const MESSAGE =
	"Waits on time in a story: a sleep, a timer, polling with eventually or waitFor, fake timers or a TestClock adjustment. Settle on the engine's own signal through a kit verb, such as a Deferred the engine completes, story.runUntil or screenDriver's settle(); when time passing is the behaviour, name it in a kit verb that advances the clock.";

const TIMERS = new Set(["setInterval", "setTimeout"]);
const VI_TIMING = /^(?:useFakeTimers|advanceTimers\w*|runAllTimers\w*|runOnlyPendingTimers\w*|runAllTicks|setSystemTime|waitFor|waitUntil)$/u;
const CLOCK_CHANGES = new Set(["adjust", "setTime"]);

function receiverOf(callee: ts.Expression): ts.Identifier | undefined {
	const receiver = ts.isPropertyAccessExpression(callee) ? unwrapped(callee.expression) : undefined;
	return receiver !== undefined && ts.isIdentifier(receiver) ? receiver : undefined;
}

function vitestTiming(receiver: ts.Identifier, bindings: ReadonlyMap<string, ImportBinding>): boolean {
	const binding = bindings.get(receiver.text);
	return binding === undefined ? receiver.text === "vi" : bindsModule(binding, "vi", ["vitest", "@effect/vitest"]);
}

function timedWait(call: ts.CallExpression, bindings: ReadonlyMap<string, ImportBinding>): boolean {
	const callee = unwrapped(call.expression);
	if (ts.isIdentifier(callee)) {
		return TIMERS.has(callee.text) || bindings.get(callee.text)?.imported === "eventually";
	}
	const member = memberName(callee) ?? "";
	const receiver = receiverOf(callee);
	if (receiver === undefined) {
		return false;
	}
	const binding = bindings.get(receiver.text);
	return (
		(member === "sleep" && bindsModule(binding, "Effect", ["effect"]))
		|| (VI_TIMING.test(member) && vitestTiming(receiver, bindings))
		|| (CLOCK_CHANGES.has(member) && bindsModule(binding, "TestClock", ["effect/testing"]))
		|| (TIMERS.has(member) && receiver.text === "globalThis")
	);
}

function timedWaits(source: ts.SourceFile): readonly ts.Node[] {
	const bindings = importBindings(source);
	const found: ts.Node[] = [];
	function visit(node: ts.Node): void {
		if (ts.isCallExpression(node) && timedWait(node, bindings)) {
			found.push(node);
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
	return found;
}

export const waitOnEvents = defineRule({
	check: (inputs) => Effect.map(storySources(inputs), (stories) => stories.flatMap((file) => syntaxFindings(file, timedWaits, MESSAGE))),
	description: "Stories settle on the engine's own signals, never on sleeps, polling, fake timers or clock adjustments in the story.",
	id: "tests/wait-on-events",
});
