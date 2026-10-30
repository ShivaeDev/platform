import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { ready, tracingApp } from "#test/tracingApp.ts";

tracingApp.it("starts each request in a root span of its own", [], function* ({ sendsRequest, serverSpans }) {
	yield* sendsRequest();
	yield* sendsRequest();

	expect(yield* serverSpans()).toEqual(["a root span, ended", "a root span, ended"]);
});

tracingApp.it("runs a request's work under its server span", [], function* ({ sendsRequest, spansNamed }) {
	yield* sendsRequest();

	expect(yield* spansNamed("request work")).toEqual(['under "GET", ended']);
});

tracingApp.it("runs traits and engine steps under the story's span", [ready], function* ({ spansNamed, takesOneStep }) {
	yield* takesOneStep();

	yield* outcomes({
		"story step": [spansNamed("story step"), ['under "story", ended']],
		"story trait": [spansNamed("story trait"), ['under "story", ended']],
	});
});

tracingApp.it("continues the trace context a request's headers carry", [], function* ({ sendsRequest, serverSpans }) {
	yield* sendsRequest({ traceparent: "00-1234567890abcdef1234567890abcdef-1234567890abcdef-01" });

	expect(yield* serverSpans()).toEqual(["under external span 1234567890abcdef in trace 1234567890abcdef1234567890abcdef, ended"]);
});
