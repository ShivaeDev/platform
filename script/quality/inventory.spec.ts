import { expect } from "vitest";
import {
	configuredExcludes,
	gitignoreKeepsOutput,
	gitRepository,
	infoExcludes,
	inventoryKit,
	linkedWorktree,
	trackedOutput,
} from "#quality/test-support/inventoryKit.ts";

const { it } = inventoryKit;

it("prunes worktree copies without a gitignore", [], function* ({ collect }) {
	const inventory = yield* collect();
	expect(inventory.files).toEqual(["src/b.ts"]);
	expect(inventory.sources.map((source) => source.path)).toEqual(["src/b.ts"]);
});

it(
	"honors gitignore negations over info/exclude and core.excludesFile",
	[gitRepository, configuredExcludes, infoExcludes, gitignoreKeepsOutput],
	function* ({ collect }) {
		const inventory = yield* collect();
		expect(inventory.sources.map((source) => source.path)).toEqual(["src/b.ts", "src/cache/output.ts", "src/ignored.ts"]);
	},
);

it("skips untracked files and directories excluded only by info/exclude", [gitRepository, infoExcludes], function* ({ collect }) {
	const inventory = yield* collect();
	expect(inventory.sources.map((source) => source.path)).toEqual(["src/b.ts"]);
	expect(inventory.files).toEqual(["src/b.ts"]);
});

it("skips untracked output excluded only by a locally configured core.excludesFile", [gitRepository, configuredExcludes], function* ({ collect }) {
	const inventory = yield* collect();
	expect(inventory.sources.map((source) => source.path)).toEqual(["src/b.ts"]);
	expect(inventory.files).toEqual(["src/b.ts"]);
});

it(
	"collects tracked files matching an exclude while skipping untracked output beside them",
	[gitRepository, infoExcludes, trackedOutput],
	function* ({ collect }) {
		const inventory = yield* collect();
		expect(inventory.sources.map((source) => source.path)).toEqual(["src/b.ts", "src/cache/authored.ts"]);
		expect(inventory.files).toEqual(["src/b.ts", "src/cache/authored.ts"]);
	},
);

it("uses info/exclude in the common git directory from a linked worktree", [gitRepository, infoExcludes, linkedWorktree], function* ({ collect }) {
	const inventory = yield* collect();
	expect(inventory.sources.map((source) => source.path)).toEqual(["src/b.ts"]);
	expect(inventory.files).toEqual(["src/b.ts"]);
});
