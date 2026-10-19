import { expect } from "vitest";
import { inventoryKit } from "#quality/test-support/inventoryKit.ts";

const { it } = inventoryKit;

it("prunes worktree copies without a gitignore", [], function* ({ collect }) {
	const inventory = yield* collect();
	expect(inventory.files).toEqual(["src/b.ts"]);
	expect(inventory.sources.map((source) => source.path)).toEqual(["src/b.ts"]);
});
