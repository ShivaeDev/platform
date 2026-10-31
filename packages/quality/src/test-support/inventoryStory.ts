import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import process from "node:process";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#cli/runMain.ts";
import { collectInventory, type Inventory, type InventoryScope } from "#inventory/collect.ts";
import { readOptionalText, readRequiredText, writeText } from "#inventory/filesystem.ts";
import { walk } from "#inventory/walk.ts";
import { git } from "./git.ts";
import type { SeedFile } from "./tree.ts";

interface InventoryEngine {
	failure: string | undefined;
	inventory: Inventory | undefined;
	readonly root: string;
}

const EVERYTHING: InventoryScope = { exclude: [], extensions: [".ts", ".tsx"], sources: ["."] };

// A blocked folder cannot be read even by its owner, unless the tests run as root.
export const runsAsRoot = process.getuid?.() === 0;

function writeAll(root: string, files: readonly SeedFile[]): void {
	for (const file of files) {
		mkdirSync(dirname(join(root, file.path)), { recursive: true });
		writeFileSync(join(root, file.path), file.content);
	}
}

function collected(engine: InventoryEngine): Inventory {
	if (engine.inventory === undefined) {
		throw new Error(`Collect an inventory before reading it${engine.failure === undefined ? "" : `; collecting failed: ${engine.failure}`}`);
	}
	return engine.inventory;
}

function attempt<TValue, TError extends { readonly message: string }, TRequirements>(
	engine: InventoryEngine,
	effect: Effect.Effect<TValue, TError, TRequirements>,
): Effect.Effect<TValue | "failed", never, TRequirements> {
	return Effect.catch(effect, (error: TError) =>
		Effect.sync(() => {
			engine.failure = error.message.replaceAll(`${engine.root}${sep}`, "");
			return "failed" as const;
		}),
	);
}

export const inventoryStory = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.sync((): InventoryEngine => ({ failure: undefined, inventory: undefined, root: mkdtempSync(join(tmpdir(), "quality-inventory-")) })),
			(engine) => Effect.sync(() => rmSync(engine.root, { force: true, recursive: true })),
		),
	inspect: ({ failure, inventory }) => ({ failure, files: inventory?.files }),
	layer: services,
	name: "Quality inventory",
	stages: ["repository", "history"],
	verbs: (engine, story) => ({
		collects: (scope: Partial<InventoryScope> = {}) => {
			story.tell(`quality collects the inventory of ${JSON.stringify({ ...EVERYTHING, ...scope })}`);
			return attempt(
				engine,
				Effect.map(collectInventory(engine.root, { ...EVERYTHING, ...scope }), (inventory) => {
					engine.inventory = inventory;
					return "collected" as const;
				}),
			);
		},
		failure: () => Effect.sync(() => engine.failure),
		files: () => Effect.sync(() => collected(engine).files),
		onDisk: (path: string) => Effect.sync(() => (existsSync(join(engine.root, path)) ? readFileSync(join(engine.root, path), "utf8") : "absent")),
		readsOptional: (path: string) => {
			story.tell(`quality reads the optional ${path}`);
			return attempt(
				engine,
				Effect.map(readOptionalText(join(engine.root, path)), (text) => text ?? "absent"),
			);
		},
		readsRequired: (path: string) => {
			story.tell(`quality reads the required ${path}`);
			return attempt(engine, readRequiredText(join(engine.root, path)));
		},
		saves: (path: string, text: string) => {
			story.tell(`quality saves ${path}`);
			return attempt(engine, Effect.as(writeText(join(engine.root, path), text), "saved" as const));
		},
		source: (path: string) => Effect.sync(() => collected(engine).sources.find((source) => source.path === path)),
		sourcePaths: () => Effect.sync(() => collected(engine).sources.map((source) => source.path)),
		walks: (path: string) => {
			story.tell(`quality walks ${path}`);
			return attempt(
				engine,
				Effect.map(walk(join(engine.root, path)), (paths) => paths.map((found) => relative(engine.root, found))),
			);
		},
		writes: (...files: readonly SeedFile[]) =>
			Effect.sync(() => {
				story.tell(`the author writes ${files.map((file) => file.path).join(", ")}`);
				writeAll(engine.root, files);
			}),
	}),
});

export function repositoryHas(...files: readonly SeedFile[]) {
	return inventoryStory.trait("repository", `the repository contains ${files.map((file) => file.path).join(", ")}`, (engine) =>
		writeAll(engine.root, files),
	);
}

export function repositoryHasFolder(path: string) {
	return inventoryStory.trait("repository", `the repository has a folder at ${path}`, (engine) => {
		mkdirSync(join(engine.root, path), { recursive: true });
	});
}

export function repositoryLinks(path: string, target: string) {
	return inventoryStory.trait("repository", `the repository links ${path} to ${target}, which does not exist`, (engine) => {
		mkdirSync(dirname(join(engine.root, path)), { recursive: true });
		symlinkSync(join(engine.root, target), join(engine.root, path));
	});
}

export function folderBlocked(path: string) {
	return inventoryStory.trait("repository", `nobody may list or enter the folder ${path}`, (engine) =>
		Effect.acquireRelease(
			Effect.sync(() => {
				mkdirSync(join(engine.root, path), { recursive: true });
				chmodSync(join(engine.root, path), 0o000);
			}),
			() => Effect.sync(() => chmodSync(join(engine.root, path), 0o755)),
		),
	);
}

export function gitTracks(...paths: readonly string[]) {
	return inventoryStory.trait("history", `git tracks ${paths.join(", ")}, ignored or not`, (engine) => {
		git(engine.root, "init", "--quiet");
		git(engine.root, "add", "--force", ...paths);
	});
}
