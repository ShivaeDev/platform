import { join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { walk } from "#inventory/walk.ts";
import { linkMissingFile, removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("walking repository inputs", () => {
	it("continues past a dangling symlink while collecting the files that remain", async () => {
		const root = seedTree([{ content: "export const value = 1;", path: "present.ts" }]);
		linkMissingFile(root, "dangling.ts");
		expect(await Effect.runPromise(walk(root).pipe(Effect.provide(NodeFileSystem.layer)))).toEqual([join(root, "present.ts")]);
	});
});
