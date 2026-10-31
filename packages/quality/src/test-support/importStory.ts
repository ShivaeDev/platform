import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { services } from "#cli/runMain.ts";
import type { Fixture } from "./fixtureTree.ts";
import { git } from "./git.ts";
import { type ImportEngine, importVerbs, writeAll } from "./importVerbs.ts";
import type { SeedFile } from "./tree.ts";

export const importStory = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.sync((): ImportEngine => ({ findings: undefined, graph: undefined, root: mkdtempSync(join(tmpdir(), "quality-imports-")) })),
			(engine) => Effect.sync(() => rmSync(engine.root, { force: true, recursive: true })),
		),
	inspect: ({ findings, root }) => ({ findings, root }),
	layer: services,
	name: "Quality imports",
	stages: ["repository", "installation", "history"],
	verbs: (engine, story) => importVerbs(engine, story.tell),
});

export function repositoryHas(...files: readonly SeedFile[]) {
	return importStory.trait("repository", `the repository contains ${files.map((file) => file.path).join(", ")}`, (engine) =>
		writeAll(engine.root, files),
	);
}

export function repositoryHolds(fixture: Fixture) {
	return importStory.trait("repository", `the repository holds ${fixture.story}`, (engine) => writeAll(engine.root, fixture.files));
}

export function emptyFolders(...folders: readonly string[]) {
	return importStory.trait("repository", `the repository has the empty folders ${folders.join(", ")}`, (engine) => {
		for (const folder of folders) {
			mkdirSync(join(engine.root, folder), { recursive: true });
		}
	});
}

export function workspaceInstalled(name: string, directory: string) {
	return importStory.trait("installation", `node_modules/${name} links to the workspace package in ${directory}`, (engine) => {
		const link = join(engine.root, "node_modules", name);
		mkdirSync(dirname(link), { recursive: true });
		symlinkSync(join(engine.root, directory), link, "dir");
	});
}

export function gitTracks(...paths: readonly string[]) {
	return importStory.trait("history", `git tracks ${paths.join(", ")}`, (engine) => {
		git(engine.root, "init", "--quiet");
		git(engine.root, "add", "--force", ...paths);
	});
}
