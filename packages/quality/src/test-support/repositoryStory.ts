import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type CliAnswer, cliVerbs } from "./cliAnswers.ts";
import { commitAll, git } from "./git.ts";
import { formatTree } from "./qualityTree.ts";
import { DEFAULT_FILES, linkPackage, type SeedFile } from "./tree.ts";

interface RepositoryEngine {
	answer: CliAnswer | undefined;
	readonly root: string;
}

const INSTALLED: readonly SeedFile[] = DEFAULT_FILES.filter((file) => file.path !== "src/value.ts");

function writeAll(root: string, files: readonly SeedFile[]): void {
	for (const file of files) {
		const path = join(root, file.path);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, file.content);
	}
}

function pathsOf(files: readonly SeedFile[]): string {
	return files.map((file) => file.path).join(", ");
}

export const repositoryStory = storyKit({
	clock: "live",
	create: () =>
		Effect.acquireRelease(
			Effect.sync((): RepositoryEngine => ({ answer: undefined, root: mkdtempSync(join(tmpdir(), "quality-repository-")) })),
			(engine) => Effect.sync(() => rmSync(engine.root, { force: true, recursive: true })),
		),
	inspect: ({ answer }) => ({ answer }),
	name: "Quality repository",
	stages: ["repository", "formatting", "history"],
	verbs: (engine, story) => ({
		...cliVerbs(engine, story.tell),
		commits: (message: string) =>
			Effect.sync(() => {
				story.tell(`the author commits "${message}"`);
				commitAll(engine.root, message);
			}),
		git: (...args: readonly string[]) =>
			Effect.sync(() => {
				story.tell(`the author runs git ${args.join(" ")}`);
				return git(engine.root, ...args);
			}),
		reads: (path: string) => Effect.sync(() => (existsSync(join(engine.root, path)) ? readFileSync(join(engine.root, path), "utf8") : undefined)),
		removes: (path: string) =>
			Effect.sync(() => {
				story.tell(`the author removes ${path}`);
				rmSync(join(engine.root, path), { force: true, recursive: true });
			}),
		writes: (...files: readonly SeedFile[]) =>
			Effect.sync(() => {
				story.tell(`the author writes ${pathsOf(files)}`);
				writeAll(engine.root, files);
			}),
	}),
});

export function qualityInstalled() {
	return repositoryStory.trait("repository", "Quality is installed with its Biome preset and a .gitignore for node_modules", (engine) => {
		writeAll(engine.root, INSTALLED);
		linkPackage(engine.root);
	});
}

export function repositoryHas(...files: readonly SeedFile[]) {
	return repositoryStory.trait("repository", `the repository contains ${pathsOf(files)}`, (engine) => writeAll(engine.root, files));
}

export function biomeFormatted() {
	return repositoryStory.trait("formatting", "Biome has formatted every file, so formatting raises no finding", (engine) => {
		formatTree(engine.root);
	});
}

export function committed(message = "Base") {
	return repositoryStory.trait("history", `git records every file in the commit "${message}"`, (engine) => {
		if (!existsSync(join(engine.root, ".git"))) {
			git(engine.root, "init", "--quiet");
		}
		commitAll(engine.root, message);
	});
}
