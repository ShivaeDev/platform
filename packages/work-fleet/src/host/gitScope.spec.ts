import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { gitScopeStory } from "#test/gitScopeStory.ts";

for (const command of ["fetch", "merge-tree", "merge-base"] as const) {
	gitScopeStory.it(`closing the scope interrupts a pending ${command} and leaves its Git process gone`, [], function* (git) {
		const { base, left, right } = git.revisions();
		git.hold(command);
		const calls = {
			fetch: git.fetch(),
			"merge-base": git.ancestry(base, left),
			"merge-tree": git.merge(left, right),
		};
		const running = yield* git.start(calls[command]);
		yield* git.pending();
		expect(yield* git.processExists()).toBe(true);

		yield* running.close();

		yield* outcomes([
			["operation", () => running.outcome(), "interrupted"],
			["Git process exists", () => git.processExists(), false],
		]);
	});
}

gitScopeStory.it("a nonzero fetch exit remains a typed unavailable failure", [], function* (git) {
	git.breakRemote();

	const error = yield* git.fetch().pipe(Effect.flip);

	expect(error).toBeInstanceOf(ServiceUnavailable);
	expect(error.message).toMatch(/^git fetch failed:/u);
});

gitScopeStory.it("a failed merge prediction remains a typed unavailable failure", [], function* (git) {
	const { left } = git.revisions();

	const error = yield* git.prediction("missing-revision", left).pipe(Effect.flip);

	expect(error).toBeInstanceOf(ServiceUnavailable);
	expect(error.message).toMatch(/^git diff failed:/u);
});

gitScopeStory.it("an ancestry error remains a typed unavailable failure", [], function* (git) {
	const { left, tree } = git.revisions();

	const error = yield* git.ancestry(tree, left).pipe(Effect.flip);

	expect(error).toBeInstanceOf(ServiceUnavailable);
	expect(error.message).toMatch(/^Report revision ancestry could not be checked:/u);
});

gitScopeStory.it("exit one still reports merge conflicts and a non-ancestor instead of failing", [], function* (git) {
	const { base, left, right } = git.revisions();

	yield* outcomes([
		["conflicting paths", () => git.merge(left, right), ["file.txt"]],
		["divergent ancestry", () => git.ancestry(left, right), false],
		["descendant ancestry", () => git.ancestry(base, left), true],
	]);
});
