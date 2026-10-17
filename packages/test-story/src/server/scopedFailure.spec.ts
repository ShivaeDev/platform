import { expect, it } from "vitest";
import { runStories } from "#test/runStories.ts";

it("captures registry state before Scope closes for body, trait and after-hook failures", async () => {
	const { stories, moduleErrors } = await runStories({ include: "src/test-support/scopedStories.ts" });
	expect(moduleErrors).toEqual([]);
	expect(stories.map(({ name, state, errors }) => ({ errors: errors.join("\n"), name, state }))).toEqual([
		{
			errors: expect.stringContaining('The scoped registry when the test failed: {"count":42}'),
			name: "Scoped Registry Story: fails in the body",
			state: "failed",
		},
		{
			errors: expect.stringContaining('The scoped registry when the test failed: {"count":7}'),
			name: "Scoped Registry Story: fails in a trait",
			state: "failed",
		},
		{
			errors: expect.stringContaining('The scoped registry when the test failed: {"count":9}'),
			name: "Scoped Registry Story: fails in an after hook",
			state: "failed",
		},
	]);
}, 30_000);
