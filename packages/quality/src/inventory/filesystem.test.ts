import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { writeText } from "#inventory/filesystem.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("writing quality inputs", () => {
	it("creates absent parent directories before saving a baseline", async () => {
		const path = join(seedTree([]), "quality", "nested", "baseline.jsonl");
		await Effect.runPromise(writeText(path, "entry\n").pipe(Effect.provide(NodeFileSystem.layer)));
		expect(readFileSync(path, "utf8")).toBe("entry\n");
	});

	it("names the unwritable baseline when its parent is a file", async () => {
		const path = join(seedTree([{ content: "occupied", path: "quality" }]), "quality", "baseline.jsonl");
		const failure = await Effect.runPromise(writeText(path, "entry\n").pipe(Effect.provide(NodeFileSystem.layer), Effect.flip));
		expect(failure).toMatchObject({ _tag: "FilesystemFailure", path });
		expect(failure.message).toBe(`cannot write ${path}: AlreadyExists: FileSystem.makeDirectory (${dirname(path)})`);
	});
});
