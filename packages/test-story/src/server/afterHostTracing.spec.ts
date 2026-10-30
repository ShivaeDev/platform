import { expect } from "vitest";
import { afterTracingApp } from "#test/afterTracingApp.ts";
import { storyRunner } from "#test/storyRunner.ts";

afterTracingApp.it(
	"starts each request to a host booted after the deployment in a root span of its own",
	[],
	function* ({ sendsRequest, serverSpans }) {
		yield* sendsRequest();
		yield* sendsRequest();

		expect(yield* serverSpans()).toEqual(["a root span, ended", "a root span, ended"]);
	},
);

afterTracingApp.it("runs the story's request verb under the story's span", [], function* ({ sendsRequest, spansNamed }) {
	yield* sendsRequest();

	expect(yield* spansNamed("request verb")).toEqual(['under "story", ended']);
});

for (const name of ["engine startup", "host startup", "host ready", "ready ensuring"]) {
	afterTracingApp.it(`runs the ${name} span of creation and after hooks outside the story's span`, [], function* ({ spansNamed }) {
		expect(yield* spansNamed(name)).toEqual(["a root span, ended"]);
	});
}

storyRunner.it("runs hook finalizers and host teardown outside the story's span once the story ends", [], function* ({ lifetime, runStory }) {
	yield* runStory("tracingStories", "After Tracing App Story: boots and tears down a host");

	expect(yield* lifetime()).toEqual([
		"engine finalizer: a root span, ended",
		"deployment finalizer: a root span, ended",
		"ready finalizer: a root span, ended",
		"host teardown: a root span, ended",
	]);
});
