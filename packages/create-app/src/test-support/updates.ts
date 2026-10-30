import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { cliAnswer } from "./answers.ts";
import { appReadouts } from "./appReadouts.ts";
import { appFolder, runCli } from "./cli.ts";
import { createEngine } from "./createEngine.ts";
import { releases } from "./releases.ts";
import { templateSource } from "./templateSource.ts";

const decodeManifest = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)));

export const updates = storyKit({
	clock: "live",
	*create() {
		const engine = yield* createEngine();
		const original = engine.source.starter;
		engine.source = templateSource(dirname(dirname(engine.cli)));
		cpSync(original, engine.source.starter, {
			filter: (path) => !["node_modules", "dist", "coverage", ".env.local"].includes(path.split("/").at(-1) ?? ""),
			recursive: true,
		});
		appFolder(engine.root);
		const registry = yield* releases(dirname(engine.root));
		const manifest = join(dirname(dirname(engine.cli)), "package.json");
		const target = join(engine.root, "my-app");
		const environment = [
			...engine.environment,
			`npm_config_registry=${registry.origin}`,
			`npm_config_cache=${join(dirname(engine.root), "npm-cache")}`,
		];
		return {
			...engine,
			generator: (version: string) => {
				writeFileSync(manifest, JSON.stringify({ ...decodeManifest(readFileSync(manifest, "utf8")), version }));
			},
			publish: (version: string) => registry.publish(version, engine.source.output),
			run: (args: readonly string[], cwd: string) =>
				Effect.gen(function* () {
					yield* engine.source.pack();
					return yield* runCli(engine.root, engine.cli, true, args, environment, cwd);
				}),
			target,
		};
	},
	inspect: (engine) => ({ answers: engine.answers, root: engine.root }),
	layer: NodeServices.layer,
	name: "starter update",
	stages: ["previous", "created", "customized", "current"],
	verbs: (engine, story) => ({
		...appReadouts(() => engine.target),
		answer: () => Effect.sync(() => engine.answers.at(-1) ?? "create-app has not run"),
		starterFile: (path: string) => Effect.sync(() => readFileSync(join(engine.source.starter, path), "utf8")),
		update: () => {
			story.tell("my-app runs create-app update");
			return engine.run(["update"], engine.target).pipe(
				Effect.map((result) => {
					const answer = cliAnswer(result, engine.root, (stdout) => stdout.trim());
					engine.answers.push(answer);
					return answer;
				}),
			);
		},
	}),
});
