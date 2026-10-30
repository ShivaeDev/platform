import { join } from "node:path";
import process from "node:process";
import { NodeFileSystem } from "@effect/platform-node";
import { afterEach, expect } from "vitest";
import { collectInventory } from "#inventory/collect.ts";
import { readOptionalText, readRequiredText } from "#inventory/filesystem.ts";
import { walk } from "#inventory/walk.ts";
import {
	blockedInventoryDirectory,
	manifestUnderFile,
	removeInventoryRepositories,
	unicodePathsRepository,
	unreadableManifestRepository,
} from "#test/inventoryFixtures.ts";
import { failureText, makeRoot, repository, scope } from "#test/inventoryRepository.ts";
import { it as effectIt } from "#test/it.ts";

afterEach(removeInventoryRepositories);

const asRoot = process.getuid?.() === 0;

effectIt.layer(NodeFileSystem.layer)("filesystem adapter", (it) => {
	it.effect("treats a missing optional file as absent", function* () {
		expect(yield* readOptionalText(join(makeRoot(), ".gitignore"))).toBeUndefined();
	});

	it.effect("reports an optional manifest whose parent is a file", function* () {
		const path = manifestUnderFile();
		const text = yield* failureText(readOptionalText(path));
		expect(text).toContain("cannot read");
		expect(text).toContain(path);
	});

	it.effect("fails distinctly when a required file is missing", function* () {
		const path = join(makeRoot(), "pnpm-workspace.yaml");
		const text = yield* failureText(readRequiredText(path));
		expect(text).toContain("required input is missing");
		expect(text).toContain(path);
	});

	it.effect("fails loudly when a file cannot be read", function* () {
		const root = unreadableManifestRepository();
		const text = yield* failureText(readRequiredText(join(root, "package.json")));
		expect(text).toContain("FilesystemFailure");
		expect(text).toContain(join(root, "package.json"));
	});

	it.effect.skipIf(asRoot)("fails loudly when a directory cannot be listed", function* () {
		const blocked = blockedInventoryDirectory();
		const text = yield* failureText(walk(blocked));
		expect(text).toContain("FilesystemFailure");
		expect(text).toContain(blocked);
	});
});

effectIt.layer(NodeFileSystem.layer)("inventory", (it) => {
	it.effect("lists every file and reads the sources with the configured extensions", function* () {
		const inventory = yield* collectInventory(repository(), scope({}));
		expect(inventory.files).toEqual(["docs/notes.md", "scripts/tool.ts", "src/app.ts", "src/routes/tree.gen.ts", "src/view.tsx"]);
		expect(inventory.sources.map((source) => source.path)).toEqual(["scripts/tool.ts", "src/app.ts", "src/routes/tree.gen.ts", "src/view.tsx"]);
		expect(inventory.sources.find((source) => source.path === "src/app.ts")).toEqual({ lines: ["a", "b"], path: "src/app.ts", text: "a\nb\n" });
	});

	it.effect("walks only the configured sources, which may name single files", function* () {
		const inventory = yield* collectInventory(repository(), scope({ sources: ["src", "scripts/tool.ts", "src"] }));
		expect(inventory.files).toEqual(["scripts/tool.ts", "src/app.ts", "src/routes/tree.gen.ts", "src/view.tsx"]);
	});

	it.effect("orders paths by UTF-16 code units and keeps overlapping sources unique", function* () {
		const root = unicodePathsRepository();
		const inventory = yield* collectInventory(root, scope({ sources: ["src", "src/a.ts", "src"] }));
		const expected = [
			"src/B.ts",
			"src/Z.ts",
			"src/a.ts",
			"src/a10.ts",
			"src/a2.ts",
			"src/aa.ts",
			"src/e\u0301.ts",
			"src/á.ts",
			"src/𐀀.ts",
			"src/😀.ts",
			"src/\uE000.ts",
		];
		expect(inventory.files).toEqual(expected);
		expect(inventory.sources).toEqual(expected.map((path) => ({ lines: [path], path, text: path })));
	});

	it.effect("leaves out excluded paths, written in .gitignore syntax", function* () {
		const inventory = yield* collectInventory(repository(), scope({ exclude: ["*.gen.ts", "docs/"] }));
		expect(inventory.files).toEqual(["scripts/tool.ts", "src/app.ts", "src/view.tsx"]);
	});

	it.effect("fails when a configured source does not exist or leaves the repository", function* () {
		const root = repository();
		expect(yield* failureText(collectInventory(root, scope({ sources: ["srcc"] })))).toContain('source "srcc" does not exist');
		expect(yield* failureText(collectInventory(root, scope({ sources: ["../elsewhere"] })))).toContain("outside the repository");
	});
});
