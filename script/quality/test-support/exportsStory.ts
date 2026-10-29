import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { runQuality } from "#quality-fixtures/cli.ts";
import { defaultTree } from "#quality-fixtures/tree.ts";
import { writePackageExports } from "#quality-fixtures/writePackageExports.ts";

export const filePathExports = {
	"./*.ts": { default: "./dist/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" },
	"./package.json": "./package.json",
};

export const exportsStory = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.sync(() => defaultTree()),
			(root) => Effect.sync(() => rmSync(root, { force: true, recursive: true })),
		),
	name: "Package exports",
	stages: ["repository"],
	verbs: (root, story) => ({
		lint: () =>
			Effect.promise(() => {
				story.tell("the author runs Quality lint in process with the default rules");
				return runQuality(root, "lint");
			}),
		writesExports: (exports: unknown, path = "modules/library/package.json") =>
			Effect.sync(() => {
				story.tell(`the author writes exports in ${path}`);
				writePackageExports(root, exports, path);
			}),
	}),
});

export function workspaceWithExports(exports: unknown) {
	return exportsStory.trait("repository", "a workspace package declares exports", (root) => {
		writeFileSync(
			join(root, "package.json"),
			'{\n\t"name": "workspace",\n\t"private": true,\n\t"workspaces": [\n\t\t"modules/*"\n\t],\n\t"scripts": {\n\t\t"sample": "node src/value.ts"\n\t}\n}\n',
		);
		writePackageExports(root, exports, "modules/library/package.json");
	});
}

export function standaloneWithExports(exports: unknown) {
	return exportsStory.trait("repository", "a standalone package declares exports", (root) => writePackageExports(root, exports, "package.json"));
}
