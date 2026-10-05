import { chmodSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { NodeFileSystem } from "@effect/platform-node";
import { Cause, Effect, Exit } from "effect";
import { afterEach, expect } from "vitest";
import { collectInventory, type InventoryScope } from "#inventory/collect.ts";
import { readOptionalText, readRequiredText } from "#inventory/filesystem.ts";
import { walk } from "#inventory/walk.ts";
import { it } from "#test/it.ts";
import { removeSeededTrees, seedTree } from "#test/tree.ts";

const roots: string[] = [];

const makeRoot = (): string => {
	const root = mkdtempSync(join(tmpdir(), "quality-fs-"));
	roots.push(root);
	return root;
};

afterEach(() => {
	removeSeededTrees();
	for (const root of roots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

const failureText = <Value, Error, Requirements>(effect: Effect.Effect<Value, Error, Requirements>): Effect.Effect<string, never, Requirements> =>
	Effect.map(Effect.exit(effect), (exit) => (Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "(it succeeded)"));

const asRoot = process.getuid?.() === 0;

const scope = (overrides: Partial<InventoryScope>): InventoryScope => ({ exclude: [], extensions: [".ts", ".tsx"], sources: ["."], ...overrides });

const repository = () =>
	seedTree([
		{ content: "a\nb\n", path: "src/app.ts" },
		{ content: "<p/>\n", path: "src/view.tsx" },
		{ content: "# Notes\n", path: "docs/notes.md" },
		{ content: "export const route = 1;\n", path: "src/routes/tree.gen.ts" },
		{ content: "export {};\n", path: "scripts/tool.ts" },
	]);

it.layer(NodeFileSystem.layer)("filesystem adapter", (it) => {
	it.effect("treats a missing optional file as absent", function* () {
		expect(yield* readOptionalText(join(makeRoot(), ".gitignore"))).toBeUndefined();
	});

	it.effect("fails distinctly when a required file is missing", function* () {
		const path = join(makeRoot(), "pnpm-workspace.yaml");
		const text = yield* failureText(readRequiredText(path));
		expect(text).toContain("required input is missing");
		expect(text).toContain(path);
	});

	it.effect("fails loudly when a file cannot be read", function* () {
		const root = makeRoot();
		mkdirSync(join(root, "package.json"));
		const text = yield* failureText(readRequiredText(join(root, "package.json")));
		expect(text).toContain("FilesystemFailure");
		expect(text).toContain(join(root, "package.json"));
	});

	it.effect.skipIf(asRoot)("fails loudly when a directory cannot be listed", function* () {
		const blocked = join(makeRoot(), "packages");
		mkdirSync(blocked);
		chmodSync(blocked, 0o000);
		const text = yield* failureText(walk(blocked));
		chmodSync(blocked, 0o755);
		expect(text).toContain("FilesystemFailure");
		expect(text).toContain(blocked);
	});
});

it.layer(NodeFileSystem.layer)("inventory", (it) => {
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
