import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import process from "node:process";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { runQuality } from "#quality-fixtures/cli.ts";
import { defaultTree } from "#quality-fixtures/tree.ts";

const biome = createRequire(import.meta.url).resolve("@biomejs/biome/bin/biome");

export const qualityKit = storyKit({
	clock: "live",
	create: () => Effect.acquireRelease(Effect.sync(defaultTree), (root) => Effect.sync(() => rmSync(root, { force: true, recursive: true }))),
	name: "Quality repository",
	stages: ["repository"],
	verbs: (root, story) => ({
		biomeWrite: () =>
			Effect.sync(() => {
				story.tell("run biome check --write --unsafe with the shared preset");
				return spawnSync(process.execPath, [biome, "check", "--write", "--unsafe", "."], { cwd: root, encoding: "utf8" });
			}),
		fix: () => {
			story.tell("run the repository formatter through quality fix");
			return Effect.promise(() => runQuality(root, "fix"));
		},
		lint: () => {
			story.tell("lint the repository through Quality");
			return Effect.promise(() => runQuality(root, "lint"));
		},
		read: (path: string) => readFileSync(join(root, path), "utf8"),
	}),
});

export const indexOfComparison = qualityKit.trait("repository", "an author checks membership with indexOf", (root) => {
	writeFileSync(join(root, "src/contains.ts"), "export function contains(value: number): boolean {\n\treturn [1, 2, 3].indexOf(value) !== -1;\n}\n");
});
