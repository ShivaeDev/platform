import { expect } from "vitest";
import { releaseDiff } from "#ci/test-support/releaseDiff.ts";

releaseDiff.it(
	"an applied release from an earlier date takes the fast path without changing the checkout",
	[],
	function* ({ apply, check, commit, git }) {
		yield* apply();
		yield* commit();
		const worktrees = yield* git("worktree", "list", "--porcelain");
		expect(yield* check()).toBe(true);
		expect(yield* git("status", "--porcelain")).toBe("");
		expect(yield* git("worktree", "list", "--porcelain")).toBe(worktrees);
	},
);

releaseDiff.it("a non-release commit runs full CI", [], function* ({ check, commit, write }) {
	yield* write("packages/platform/src/behavior.ts", "export const changed = true;\n");
	yield* commit();
	expect(yield* check()).toBe(false);
});

for (const [path, addition] of [
	["packages/platform/src/behavior.ts", "export const changed = true;\n"],
	["packages/platform/CHANGELOG.md", "\nUncollected release notes.\n"],
	["packages/work-board/src/server/packageInfo.ts", "export const extra = true;\n"],
	["packages/work-fleet/src/packageInfo.ts", "export const extra = true;\n"],
	[".changeset/pending.md", '---\n"@shivaedev/platform": patch\n---\n\n### Fixed\n\n- Retained input.\n'],
] as const) {
	releaseDiff.it(`a release with an extra edit to ${path} runs full CI`, [], function* ({ apply, check, commit, git, write }) {
		yield* apply();
		yield* commit();
		const released = yield* git("rev-parse", "HEAD");
		yield* write(path, addition);
		yield* commit();
		expect(yield* check()).toBe(false);
		expect(yield* check("main", released)).toBe(true);
	});
}

for (const [path, before, after] of [
	["packages/platform/package.json", '"version": "0.15.1"', '"version": "0.15.1", "scripts": {"test": "echo bypass"}'],
	["examples/starter/published-versions.json", '"0.15.1"', '"99.0.0"'],
	[".changeset/release.json", "Release pending behavior.", "Altered release inputs."],
] as const) {
	releaseDiff.it(`a release with altered data in ${path} runs full CI`, [], function* ({ apply, check, commit, read, write }) {
		yield* apply();
		yield* write(path, (yield* read(path)).replace(before, after));
		yield* commit();
		expect(yield* check()).toBe(false);
	});
}

releaseDiff.it("a release with an unrelated executable-bit change runs full CI", [], function* ({ apply, check, git }) {
	yield* apply();
	yield* git("add", "--all");
	yield* git("update-index", "--chmod=+x", "packages/platform/package.json");
	yield* git("commit", "-m", "Release with changed permissions");
	expect(yield* check()).toBe(false);
});

releaseDiff.it("a missing base falls back to full CI", [], function* ({ apply, check, commit, git }) {
	yield* apply();
	yield* commit();
	const worktrees = yield* git("worktree", "list", "--porcelain");
	expect(yield* check("missing-base")).toBe(false);
	expect(yield* git("worktree", "list", "--porcelain")).toBe(worktrees);
});
