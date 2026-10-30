import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { vi } from "vitest";
import { services } from "@shivaedev/quality/cli/runMain.ts";
import { collectInventory } from "@shivaedev/quality/inventory/collect.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { git } from "#quality-fixtures/git.ts";
import { seedTree } from "#quality-fixtures/tree.ts";

export const inventoryKit = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.sync(() => {
				vi.stubEnv("GIT_CONFIG_GLOBAL", "/dev/null");
				vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
				const root = seedTree([
					{ content: "export const b = 1;", path: "src/b.ts" },
					{ content: "export const a = 1;", path: ".worktrees/copy/src/a.ts" },
					{ content: "export const a = 1;", path: "nested/.worktrees/copy/src/a.ts" },
				]);
				return { cwd: root, root };
			}),
			({ root }) =>
				Effect.sync(() => {
					rmSync(root, { force: true, recursive: true });
					vi.unstubAllEnvs();
				}),
		),
	name: "inventory",
	stages: ["repository"],
	verbs: (engine, story) => ({
		collect: () => {
			story.tell("collect the repository inventory");
			return collectInventory(engine.cwd, { exclude: [], extensions: [".ts"], sources: ["."] }).pipe(Effect.provide(services));
		},
	}),
});

export const gitRepository = inventoryKit.trait("repository", "the files are in a git repository", ({ root }) => {
	git(root, "init", "--quiet");
	git(root, "config", "--local", "core.excludesFile", "/dev/null");
	mkdirSync(join(root, "src/cache"));
	writeFileSync(join(root, "src/cache/output.ts"), "export const output = 1;");
	writeFileSync(join(root, "src/ignored.ts"), "export const ignored = 1;");
});

export const infoExcludes = inventoryKit.trait("repository", "only info/exclude ignores the output", ({ root }) => {
	writeFileSync(join(root, ".git/info/exclude"), "src/ignored.ts\nsrc/cache/\n");
});

export const configuredExcludes = inventoryKit.trait("repository", "only the locally configured excludes file ignores the output", ({ root }) => {
	const excludes = join(root, ".git/local-excludes");
	writeFileSync(excludes, "src/ignored.ts\nsrc/cache/\n");
	git(root, "config", "--local", "core.excludesFile", excludes);
});

export const trackedOutput = inventoryKit.trait("repository", "an authored file is tracked inside an ignored directory", ({ root }) => {
	writeFileSync(join(root, "src/cache/authored.ts"), "export const authored = 1;");
	git(root, "add", "--force", "src/cache/authored.ts");
});

export const linkedWorktree = inventoryKit.trait("repository", "discovery runs in a linked worktree", (engine) => {
	git(engine.root, "add", "src/b.ts");
	git(engine.root, "commit", "--quiet", "--message", "Initial sources");
	engine.cwd = join(engine.root, "linked");
	git(engine.root, "worktree", "add", "--quiet", "-b", "linked", engine.cwd);
	mkdirSync(join(engine.cwd, "src/cache"));
	writeFileSync(join(engine.cwd, "src/cache/output.ts"), "export const output = 1;");
	writeFileSync(join(engine.cwd, "src/ignored.ts"), "export const ignored = 1;");
});

export const gitignoreKeepsOutput = inventoryKit.trait("repository", ".gitignore keeps files excluded by the other two sources", ({ root }) => {
	writeFileSync(join(root, ".gitignore"), "!src/ignored.ts\n!src/cache/\n");
});
