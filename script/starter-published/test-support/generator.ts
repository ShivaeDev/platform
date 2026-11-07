import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { command, writeJson } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";
import { generateStarter } from "#starter-published/generate.ts";

const unpublished = { name: "@shivaedev/sql", version: "999.0.0" };

export const generator = storyKit({
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "packed-generator-story-" });
		yield* fs.symlink(join(process.cwd(), "script"), join(root, "script"));
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
		const dependencyArchive = join(archives, "sql.tgz");
		yield* command(dependency, "pnpm", ["pack", "--out", dependencyArchive]);
		yield* command(createApp, "pnpm", ["pack", "--out", archive]);
		yield* fs.makeDirectory(join(root, "examples/starter"), { recursive: true });
		yield* writeJson(join(root, "examples/starter/published-versions.json"), { [unpublished.name]: unpublished.version });
		const packages: Package[] = [
			{ directory: createApp, manifest: { name: "@shivaedev/create-app", version: "1.0.0" }, tarball: archive },
			{ directory: dependency, manifest: unpublished, tarball: dependencyArchive },
		];
		return { packages, root };
	},
	layer: NodeServices.layer,
	name: "packed starter generator",
	stages: [],
	verbs: ({ packages, root }, story) => ({
		generate: Effect.fn("GeneratorStory.generate")(function* () {
			story.tell(`the packed create-app depends on ${unpublished.name}@${unpublished.version}, which the registry does not have`);
			yield* generateStarter(root, root, packages);
		}),
		starterOrigin: Effect.fn("GeneratorStory.starterOrigin")(function* () {
			return yield* (yield* FileSystem.FileSystem).readFileString(join(root, "starter/origin"));
		}),
	}),
});
