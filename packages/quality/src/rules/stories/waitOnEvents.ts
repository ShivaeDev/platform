import { Effect } from "effect";
import ts from "typescript";
import { isTestSupport } from "#naming/testName.ts";
import { defineRule } from "#rule.ts";
import { failingSleep } from "./failureDeadline.ts";
import { bindsModule, type ImportBinding, importBindings } from "./importBindings.ts";
import { realTime } from "./realTime.ts";
import { storyWaitSources } from "./sources.ts";
import { memberName, syntaxFindings, unwrapped } from "./syntax.ts";

const MESSAGE =
	"Waits on time in a story or reachable test-support: a sleep, a real timer, a wall-clock read such as Date.now(), polling with eventually or waitFor, fake timers or a clock adjustment in the spec. Settle on the engine's own signal through a kit verb, such as a Deferred the engine completes, story.runUntil or screenDriver's settle(). A deadline bounds a failure but does not prove completion; reaching it must fail the story. When time passing is the behaviour, name it in a kit verb that advances TestClock.";

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

function timedWait(call: ts.CallExpression, bindings: ReadonlyMap<string, ImportBinding>, support: boolean): boolean {
	const callee = unwrapped(call.expression);
	if (ts.isIdentifier(callee)) {
		const binding = bindings.get(callee.text);
		return (
			binding?.imported === "eventually"
			|| (binding?.module === "effect/Effect" && binding.imported === "sleep" && !failingSleep(call, bindings))
			|| realTime(call, bindings)
		);
	}
	const member = memberName(callee) ?? "";
	const receiver = receiverOf(callee);
	if (receiver === undefined) {
		return realTime(call, bindings);
	}
	const binding = bindings.get(receiver.text);
	return (
		realTime(call, bindings)
		|| (member === "sleep" && bindsModule(binding, "Effect", ["effect"]) && !failingSleep(call, bindings))
		|| (VI_TIMING.test(member) && vitestTiming(receiver, bindings))
		|| (!support && CLOCK_CHANGES.has(member) && bindsModule(binding, "TestClock", ["effect/testing"]))
	);
}

function timedWaits(source: ts.SourceFile): readonly ts.Node[] {
	const bindings = importBindings(source);
	const support = isTestSupport(source.fileName);
	const found: ts.Node[] = [];
	function visit(node: ts.Node): void {
		if ((ts.isCallExpression(node) && timedWait(node, bindings, support)) || (ts.isNewExpression(node) && realTime(node, bindings))) {
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
	registrable: false,
});
