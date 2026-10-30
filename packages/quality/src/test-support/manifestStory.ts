import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { manifestReader } from "#adapters/manifestReader.ts";
import { runQuality } from "./cli.ts";
import { config, linkPackage, seedTree } from "./tree.ts";

export const manifestStory = storyKit({
	create: () =>
		Effect.gen(function* () {
			const root = seedTree([config('{ sources: ["src"] }'), { content: "export const value = 1;\n", path: "src/value.ts" }]);
			linkPackage(root);
			yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root, { force: true, recursive: true })));
			return { root };
		}),
	inspect: ({ root }) => ({ root }),
	name: "Quality manifest inventory",
	stages: ["repository"],
	verbs: ({ root }) => ({
		fixes: () => Effect.promise(() => runQuality(root, "fix")),
		lints: () => Effect.promise(() => runQuality(root, "lint")),
		readsConcurrently: (path: string) =>
			Effect.gen(function* () {
				const reader = yield* manifestReader(root);
				const reads: string[] = [];
				function readText(file: string) {
					reads.push(file);
					return reader(file);
				}
				const manifests = yield* Effect.promise(() => Promise.all([readPackageManifest(readText, path), readPackageManifest(readText, `./${path}`)]));
				return { manifests, reads };
			}).pipe(Effect.provide(NodeFileSystem.layer)),
	}),
});

export function manifestContains(path: string, content: string) {
	return manifestStory.trait("repository", `${path} contains ${content}`, ({ root }) => {
		const file = join(root, path);
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, content);
	});
}

export const manifestIsDirectory = manifestStory.trait("repository", "package.json is a directory", ({ root }) => {
	mkdirSync(join(root, "package.json"));
});
