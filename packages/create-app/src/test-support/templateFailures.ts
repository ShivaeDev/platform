import { Buffer } from "node:buffer";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { CreateAppError } from "#CreateAppError.ts";
import { renderTemplate } from "#generation.ts";
import { packTemplate } from "#packTemplate.ts";

export const templateFailures = storyKit({
	*create() {
		const fs = yield* FileSystem.FileSystem;
		const root = yield* fs.makeTempDirectoryScoped({ prefix: "template-failures-" });
		const starter = join(root, "starter");
		yield* fs.makeDirectory(starter);
		yield* fs.writeFileString(join(starter, "published-versions.json"), "{}");
		const engine: { failure: CreateAppError | undefined; files: Readonly<Record<string, string>>; root: string; starter: string } = {
			failure: undefined,
			files: {},
			root,
			starter,
		};
		return engine;
	},
	inspect: (engine) => ({ root: engine.root }),
	layer: NodeServices.layer,
	name: "template failure",
	stages: ["template"],
	verbs: (engine, story) => {
		function keepFailure(failure: CreateAppError) {
			return Effect.sync(() => {
				engine.failure = failure;
			});
		}
		return {
			failure: () => engine.failure,
			pack: () => {
				story.tell("the starter is packed");
				return packTemplate(engine.starter, join(engine.root, "template.json")).pipe(Effect.catchTag("CreateAppError", keepFailure));
			},
			render: () => {
				story.tell("the packed template is rendered");
				const template = Object.entries(engine.files).map(([path, content]) => ({ content: Buffer.from(content).toString("base64"), path }));
				return renderTemplate(join(engine.root, "app"), template, "demo").pipe(Effect.catchTag("CreateAppError", keepFailure));
			},
		};
	},
});

export const malformedManifest = templateFailures.trait("template", "package.json has a non-string dependency version", function* (engine) {
	const fs = yield* FileSystem.FileSystem;
	const manifest = JSON.stringify({
		dependencies: { effect: 42 },
		devDependencies: {},
		engines: {},
		imports: {},
		name: "starter",
		packageManager: "pnpm@12.15.0",
		private: true,
		scripts: {},
		type: "module",
		version: "0.0.0",
	});
	engine.files = { "package.json": manifest };
	yield* fs.writeFileString(join(engine.starter, "package.json"), manifest);
});
