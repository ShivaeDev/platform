import { expect } from "vitest";
import { ciEnvironment, testOutputStory } from "#test/outputPolicy.ts";

const { it } = testOutputStory;

it("keeps a passing test's diagnostic visible in CI", [ciEnvironment("true")], function* ({ run }) {
	expect(yield* run()).toContain("diagnostic from a passing test");
});

it("hides a passing test's diagnostic outside CI", [ciEnvironment("")], function* ({ run }) {
	const output = yield* run();
	expect(output).toContain("1 passed");
	expect(output).not.toContain("diagnostic from a passing test");
});
