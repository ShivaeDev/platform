import { renameSync } from "node:fs";
import { join } from "node:path";
import { baselineStory, setupRun } from "./baselineStory.ts";
import { trees } from "./cli.ts";
import { branchOff, commitAll, git } from "./git.ts";
import { formatTree } from "./qualityTree.ts";
import { sourceOf, writeAll } from "./recordedDebt.ts";
import { linkPackage, type SeedFile } from "./tree.ts";

const INSTALLED: readonly SeedFile[] = [
	{ content: "node_modules/\n", path: ".gitignore" },
	{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n', path: "biome.json" },
];

const LEGACY = { "src/long.ts": { count: 1, measure: 4 }, "src/longer.ts": { count: 1, measure: 7 }, "src/short.ts": { count: 1, measure: 5 } };

function installed(root: string, files: readonly SeedFile[]): void {
	writeAll(root, [...INSTALLED, ...files]);
	linkPackage(root);
	formatTree(root);
}

const OVER_LIMIT =
	"src/long.ts runs 1 line and src/longer.ts 3 lines over the 3-line limit of structure/max-lines, while src/short.ts stays within it";

export function debtRecorded() {
	return baselineStory.trait("repository", `${OVER_LIMIT}, and quality baseline write records that debt`, function* (engine) {
		installed(engine.root, trees.dirty);
		yield* setupRun(engine, "baseline", "write");
	});
}

export function earlierBaseline() {
	return baselineStory.trait(
		"repository",
		`${OVER_LIMIT}, and quality/baseline.json in the earlier format measures src/long.ts at 4 lines, src/longer.ts at 7 and src/short.ts, since fixed, at 5`,
		(engine) =>
			installed(engine.root, [...trees.dirty, { content: JSON.stringify({ "structure/max-lines": LEGACY }), path: "quality/baseline.json" }]),
	);
}

export function qualityConfigured() {
	return baselineStory.trait("repository", "Quality is installed with a 3-line limit for structure/max-lines", (engine) =>
		installed(
			engine.root,
			trees.dirty.filter((file) => file.path === "quality.config.ts"),
		),
	);
}

export function repositoryHas(...files: readonly SeedFile[]) {
	return baselineStory.trait("baseline", `the repository contains ${files.map((file) => file.path).join(", ")}`, (engine) =>
		writeAll(engine.root, files),
	);
}

export function branchedFromMain() {
	return baselineStory.trait("history", "git commits every file on main, and the author works on the branch work", (engine) => {
		branchOff(engine.root);
	});
}

function lines(count: number): string {
	return count === 1 ? "1 line" : `${count} lines`;
}

export function shortened(path: string, count: number) {
	return baselineStory.trait("work", `the author shortens ${path} to ${lines(count)}`, (engine) =>
		writeAll(engine.root, [{ content: sourceOf(count), path }]),
	);
}

export function lengthened(path: string, count: number) {
	return baselineStory.trait("work", `the author lengthens ${path} to ${lines(count)}`, (engine) =>
		writeAll(engine.root, [{ content: sourceOf(count), path }]),
	);
}

export function added(path: string, count: number) {
	return baselineStory.trait("work", `the author adds ${path} with ${lines(count)}`, (engine) =>
		writeAll(engine.root, [{ content: sourceOf(count), path }]),
	);
}

export function renamed(from: string, to: string) {
	return baselineStory.trait("work", `the author renames ${from} to ${to}`, (engine) => renameSync(join(engine.root, from), join(engine.root, to)));
}

export function staged(path: string) {
	return baselineStory.trait("work", `the author stages ${path}`, (engine) => {
		git(engine.root, "add", path);
	});
}

export function deletedWithGit(path: string) {
	return baselineStory.trait("work", `the author deletes ${path} with git rm`, (engine) => {
		git(engine.root, "rm", "--quiet", "--force", path);
	});
}

export function movedWithGit(from: string, to: string) {
	return baselineStory.trait("work", `the author moves ${from} to ${to} with git mv`, (engine) => {
		git(engine.root, "mv", from, to);
	});
}

export function moveCommitted(from: string, to: string) {
	return baselineStory.trait("work", `the author moves ${from} to ${to} with git mv and commits the move`, (engine) => {
		git(engine.root, "mv", from, to);
		commitAll(engine.root, "Move");
	});
}
