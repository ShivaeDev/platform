import { execFileSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { workspaceDocumentation } from "#starter-published/workspaceDocumentation.ts";

const versions = { "@shivaedev/effect-contract": "999.0.0" };

export const documentationStory = storyKit({
	clock: "live",
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "workspace-documentation-story-" });
		const library = join(root, "packages/effect-contract");
		for (const path of ["docs/framework", "examples/starter", "packages/effect-contract/src/server"]) {
			yield* fs.makeDirectory(join(root, path), { recursive: true });
		}
		const catalog = execFileSync("pnpm", ["config", "get", "catalog", "--json"], { cwd: process.cwd(), encoding: "utf8" });
		function writeJson(path: string, value: unknown) {
			return fs.writeFileString(path, `${JSON.stringify(value)}\n`);
		}
		yield* fs.writeFileString(join(root, "pnpm-workspace.yaml"), `packages: ["packages/*"]\ncatalog: ${JSON.stringify(JSON.parse(catalog))}\n`);
		yield* writeJson(join(root, "package.json"), { private: true, scripts: { build: "node build.js" }, type: "module" });
		yield* writeJson(join(library, "package.json"), {
			exports: { "./*.ts": { default: "./dist/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" } },
			files: ["dist", "src"],
			name: "@shivaedev/effect-contract",
			peerDependencies: { vitest: "catalog:" },
			type: "module",
			version: versions["@shivaedev/effect-contract"],
		});
		yield* fs.writeFileString(join(library, "src/server/queue.ts"), 'export const queue = "workspace module";\n');
		yield* fs.writeFileString(
			join(root, "build.js"),
			'import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";\nmkdirSync("packages/effect-contract/dist/server", { recursive: true });\ncopyFileSync("packages/effect-contract/src/server/queue.ts", "packages/effect-contract/dist/server/queue.js");\nwriteFileSync("packages/effect-contract/dist/server/queue.d.ts", "export declare const queue: string;\\n");\n',
		);
		for (const path of ["docs/framework/quickstart.md", "examples/starter/README.md", "packages/effect-contract/README.md"]) {
			yield* fs.writeFileString(join(root, path), '```ts\nimport { queue } from "@shivaedev/effect-contract/server/queue.ts";\n```\n');
		}
		yield* writeJson(join(root, "examples/starter/published-versions.json"), { "@shivaedev/effect-contract": "0.1.0" });
		return { root };
	},
	layer: NodeServices.layer,
	name: "workspace documentation against packed APIs",
	stages: [],
	verbs: (engine, story) => ({
		check: Effect.fn("DocumentationStory.check")(function* () {
			story.tell("the registry check builds the current workspace, installs its documentation consumer and probes all documented imports");
			return yield* Effect.exit(workspaceDocumentation(engine.root, join(engine.root, "check"), { registry: true }));
		}),
		writeGuide: (specifier: string, name: string) =>
			Effect.flatMap(FileSystem.FileSystem, (fs) =>
				fs.writeFileString(join(engine.root, "docs/framework/quickstart.md"), `\`\`\`ts\nimport { ${name} } from "${specifier}";\n\`\`\`\n`),
			),
	}),
});
