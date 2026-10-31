import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { Greeting, greetingApp } from "#test/greetingFixture.ts";

greetingApp("the harness and the body read the services of the file's Layer", function* ({ greeting }) {
	yield* outcomes({
		"greeting the body yields": [Effect.service(Greeting), "hello from the Layer"],
		"greeting the harness read": [greeting(), "hello from the Layer"],
	});
});

const CONTEXT_STORY = "makeHarness and the body receive this test's Vitest context";

greetingApp(CONTEXT_STORY, function* ({ testName }, context) {
	yield* outcomes({
		"test the body was given": [Effect.succeed(context.task.name), CONTEXT_STORY],
		"test the harness was made for": [testName(), CONTEXT_STORY],
	});
});

greetingApp("the around wrapper encloses both making the harness and running the body", function* ({ harnessWrapper, wrapper }) {
	yield* outcomes({
		"the body": [wrapper(), "inside the greeting wrapper"],
		"the harness": [harnessWrapper(), "inside the greeting wrapper"],
	});
});

greetingApp.each(["alpha", "beta"])("each passes the case %s to the body with a harness made for that case's test", function* (item, { testName }) {
	expect(yield* testName()).toContain(item);
});

greetingApp("an Effect-returning body receives the harness and yields the Layer's services", ({ greeting }) =>
	outcomes({
		"greeting the body yields": [Effect.service(Greeting), "hello from the Layer"],
		"greeting the harness read": [greeting(), "hello from the Layer"],
	}),
);
