import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { command, writeJson } from "#package-check/io.ts";
import { checkDocumentation, readDocumentation } from "#starter-published/documentation.ts";
import { packedInstaller } from "#starter-published/packedInstaller.ts";
import { runStarter } from "#starter-published/run.ts";

const versions = { "@shivaedev/contract": "0.1.0" };

export const app = storyKit({
	after: {
		*source(engine) {
			const fs = yield* FileSystem.FileSystem;
			yield* command(join(engine.root, "source"), "pnpm", ["pack", "--out", join(engine.root, "archives/effect-contract.tgz")]);
			engine.path = yield* packedInstaller(process.cwd(), engine.root, engine.tarballs);
			yield* command(engine.directory, "env", [`PATH=${engine.path}`, "pnpm", "install"]);
			yield* fs.makeDirectory(join(engine.directory, "node_modules/.bin"), { recursive: true });
			yield* fs.symlink(join(process.cwd(), "node_modules/vitest/vitest.mjs"), join(engine.directory, "node_modules/.bin/vitest"));
		},
	},
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "published-starter-story-" });
		for (const path of ["source", "archives", "app", "docs/framework", "examples/starter", "packages/contract"]) {
			yield* fs.makeDirectory(join(root, path), { recursive: true });
		}
		for (const path of ["docs/framework/quickstart.md", "examples/starter/README.md", "packages/contract/README.md"]) {
			yield* fs.writeFileString(join(root, path), "");
		}
		const directory = join(root, "app");
		yield* writeJson(join(directory, "package.json"), {
			dependencies: { "@shivaedev/contract": "0.1.0" },
			private: true,
			scripts: { ci: "node ci.js", setup: "pnpm install" },
			type: "module",
		});
		yield* fs.writeFileString(join(directory, "pnpm-workspace.yaml"), "packages: []\n");
		yield* fs.writeFileString(
			join(directory, "ci.js"),
			'import { writeFileSync } from "node:fs";\nimport { query } from "@shivaedev/contract/operation.ts";\nwriteFileSync("ci-result.json", JSON.stringify({ cwd: process.cwd(), database: process.env.TEST_DATABASE_URL, query }));\n',
		);
		const tarballs: Record<string, string> = { "@shivaedev/contract": join(root, "archives/effect-contract.tgz") };
		return { database: "postgres://localhost/starter-story", directory, path: "", root, tarballs };
	},
	layer: NodeServices.layer,
	name: "published starter check over a packed installer",
	stages: ["source"],
	verbs: (engine) => ({
		ciResult: () => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(join(engine.directory, "ci-result.json"))),
		database: engine.database,
		directory: engine.directory,
		documentation: Effect.fn("PublishedStarterStory.documentation")(function* () {
			return yield* Effect.gen(function* () {
				const entries = yield* readDocumentation(engine.root, versions);
				yield* checkDocumentation(engine.directory, entries, versions);
			}).pipe(Effect.match({ onFailure: (error) => error.message, onSuccess: () => undefined }));
		}),
		documentedEntries: () => readDocumentation(engine.root, versions),
		install: () => command(engine.directory, "env", [`PATH=${engine.path}`, "pnpm", "install"]),
		installedQuery: () =>
			command(engine.directory, "node", [
				"--input-type=module",
				"--eval",
				'import { query } from "@shivaedev/contract/operation.ts"; console.log(query);',
			]),
		run: () => runStarter(engine.directory, engine.database).pipe(Effect.match({ onFailure: (error) => error.message, onSuccess: () => undefined })),
		setup: () => command(engine.directory, "env", [`PATH=${engine.path}`, "pnpm", "run", "setup"]),
		workspace: () => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(join(engine.directory, "pnpm-workspace.yaml"))),
	}),
});
