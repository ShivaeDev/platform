import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { command, writeJson } from "#package-check/io.ts";
import { generateStarter } from "#starter-published/generate.ts";

const unpublished = { name: "@shivaedev/effect-sql", version: "999.0.0" };

export const generator = storyKit({
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "packed-generator-story-" });
		const archives = join(root, "archives");
		const dependency = join(root, "dependency");
		const createApp = join(root, "create-app");
		for (const directory of [archives, dependency, createApp]) {
			yield* fs.makeDirectory(directory);
		}
		yield* writeJson(join(dependency, "package.json"), { ...unpublished, exports: "./index.js", type: "module" });
		yield* fs.writeFileString(join(dependency, "index.js"), 'export const origin = "packed archive";\n');
		yield* writeJson(join(createApp, "package.json"), {
			bin: { "create-app": "./cli.js" },
			dependencies: { [unpublished.name]: unpublished.version },
			name: "@shivaedev/create-app",
			type: "module",
			version: "1.0.0",
		});
		yield* fs.writeFileString(
			join(createApp, "cli.js"),
			`#!/usr/bin/env node\nimport { mkdirSync, writeFileSync } from "node:fs";\nimport { origin } from ${JSON.stringify(unpublished.name)};\nmkdirSync(process.argv[2]);\nwriteFileSync(\`\${process.argv[2]}/origin\`, origin);\n`,
		);
		const archive = join(archives, "create-app.tgz");
		const dependencyArchive = join(archives, "effect-sql.tgz");
		yield* command(dependency, "pnpm", ["pack", "--out", dependencyArchive]);
		yield* command(createApp, "pnpm", ["pack", "--out", archive]);
		const tarballs = { "@shivaedev/create-app": archive, [unpublished.name]: dependencyArchive };
		return { archive, root, tarballs };
	},
	layer: NodeServices.layer,
	name: "packed starter generator",
	stages: [],
	verbs: ({ archive, root, tarballs }, story) => ({
		generate: Effect.fn("GeneratorStory.generate")(function* () {
			story.tell(`the packed create-app depends on ${unpublished.name}@${unpublished.version}, which the registry does not have`);
			yield* generateStarter(process.cwd(), root, archive, tarballs);
		}),
		starterOrigin: Effect.fn("GeneratorStory.starterOrigin")(function* () {
			return yield* (yield* FileSystem.FileSystem).readFileString(join(root, "starter/origin"));
		}),
	}),
});
