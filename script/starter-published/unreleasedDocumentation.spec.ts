import { Cause, Exit } from "effect";
import { expect } from "vitest";
import { documentationStory } from "#starter-published/test-support/documentationStory.ts";

documentationStory.it("current guides and READMEs import unpublished file paths from fresh workspace archives", [], function* ({ check }) {
	expect(Exit.isSuccess(yield* check())).toBe(true);
});

for (const [specifier, name] of [
	["@shivaedev/effect-contract/server/missing.ts", "queue"],
	["@shivaedev/effect-contract/server/queue.ts", "missing"],
] as const) {
	documentationStory.it(`current documentation still rejects ${name} from ${specifier}`, [], function* ({ writeGuide, check }) {
		yield* writeGuide(specifier, name);
		const result = yield* check();
		expect(Exit.isFailure(result)).toBe(true);
		if (Exit.isFailure(result)) {
			expect(Cause.pretty(result.cause)).toContain("Published documentation API check failed");
			expect(Cause.pretty(result.cause)).toContain(`import ${name} from ${specifier} (docs/framework/quickstart.md)`);
		}
	});
}
