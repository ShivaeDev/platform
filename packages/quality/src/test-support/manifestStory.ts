import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { readPackageManifest } from "#adapters/manifestInventory.ts";
import { manifestReader } from "#adapters/manifestReader.ts";
import { type CliAnswer, cliVerbs } from "./cliAnswers.ts";
import { config, linkPackage, type SeedFile, seedTree } from "./tree.ts";

interface ManifestEngine {
	answer: CliAnswer | undefined;
	fileReads: string[];
	manifests: readonly unknown[];
	readonly root: string;
}

function repository(): string {
	const root = seedTree([
		config('{ sources: ["src"] }'),
		{ content: "node_modules/\nignored/\n", path: ".gitignore" },
		{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n', path: "biome.json" },
		{ content: "export const MAX_DEPTH = 4;\nexport const MAX_ITEMS = 10;\n", path: "src/limits.ts" },
	]);
	linkPackage(root);
	return root;
}

export const manifestStory = storyKit({
	clock: "live",
	create: () =>
		Effect.acquireRelease(
			Effect.sync((): ManifestEngine => ({ answer: undefined, fileReads: [], manifests: [], root: repository() })),
			(engine) => Effect.sync(() => rmSync(engine.root, { force: true, recursive: true })),
		),
	inspect: ({ answer, fileReads }) => ({ answer, fileReads }),
	name: "Quality manifest",
	stages: ["repository"],
	verbs: (engine, story) => ({
		...cliVerbs(engine, story.tell),
		decodedManifests: () => Effect.sync(() => engine.manifests),
		fileReads: () => Effect.sync(() => engine.fileReads),
		reads: (path: string) => Effect.sync(() => (existsSync(join(engine.root, path)) ? readFileSync(join(engine.root, path), "utf8") : undefined)),
		reportLines: (text: string) => Effect.sync(() => (engine.answer?.stdout ?? "").split("\n").filter((line) => line.includes(text))),
		sharedManifest: () => Effect.sync(() => engine.manifests.length > 1 && engine.manifests.every((manifest) => manifest === engine.manifests[0])),
		twoRulesReadAtOnce: (path: string) =>
			Effect.gen(function* () {
				story.tell(`two rules read ${path} and ./${path} at once`);
				const reader = yield* manifestReader(engine.root);
				function readText(file: string) {
					engine.fileReads.push(file);
					return reader(file);
				}
				engine.manifests = yield* Effect.promise(() =>
					Promise.all([readPackageManifest(readText, path), readPackageManifest(readText, `./${path}`)]),
				);
			}).pipe(Effect.scoped, Effect.provide(NodeFileSystem.layer)),
	}),
});

export function repositoryHas(...files: readonly SeedFile[]) {
	return manifestStory.trait("repository", `the repository contains ${files.map((file) => file.path).join(", ")}`, (engine) => {
		for (const file of files) {
			const path = join(engine.root, file.path);
			mkdirSync(dirname(path), { recursive: true });
			writeFileSync(path, file.content);
		}
	});
}

export const manifestIsDirectory = manifestStory.trait("repository", "package.json is a directory", (engine) => {
	mkdirSync(join(engine.root, "package.json"));
});

const decodeJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

// Pretty-printed, so each condition block sits on its own line and a finding's line names it.
export function conditionManifest(path: string, exports: string, imports = "{}"): SeedFile {
	return { content: `${JSON.stringify(decodeJson(`{ "name": "sample", "imports": ${imports}, "exports": ${exports} }`), null, "\t")}\n`, path };
}
