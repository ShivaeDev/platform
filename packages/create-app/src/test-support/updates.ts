import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appFolder, runCli } from "./cli.ts";
import { createEngine } from "./createEngine.ts";
import { releases } from "./releases.ts";
import { templateSource } from "./templateSource.ts";

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
		return { ...engine, registry };
	},
	inspect: (engine) => ({ root: engine.root }),
	layer: NodeServices.layer,
	name: "starter update",
	stages: [],
	verbs: (engine, story) => {
		const target = join(engine.root, "my-app");
		const manifestPath = join(dirname(dirname(engine.cli)), "package.json");
		const environment = [
			...engine.environment,
			`npm_config_registry=${engine.registry.origin}`,
			`npm_config_cache=${join(dirname(engine.root), "npm-cache")}`,
		];
		return {
			*create(args: readonly string[] = []) {
				story.tell("the user creates an app");
				yield* engine.source.pack();
				return yield* runCli(engine.root, engine.cli, true, ["my-app", ...args], environment);
			},
			edit(path: string, content: string) {
				story.tell(`the app changes ${path}`);
				writeFileSync(join(target, path), content);
			},
			exists: (path: string) => existsSync(join(target, path)),
			git: (...args: readonly string[]) => spawnSync("git", args, { cwd: target, encoding: "utf8" }),
			publish() {
				story.tell("the recorded generator is published");
				engine.registry.publish(JSON.parse(readFileSync(manifestPath, "utf8")).version, engine.source.output);
			},
			read: (path: string) => readFileSync(join(target, path), "utf8"),
			remove(path: string) {
				story.tell(`the app removes ${path}`);
				rmSync(join(target, path));
			},
			removeFromStarter(path: string) {
				story.tell(`the starter removes ${path}`);
				rmSync(join(engine.source.starter, path));
			},
			revise(files: Readonly<Record<string, string>>) {
				story.tell("the starter source changes");
				engine.source.files(files);
			},
			setVersion(version: string) {
				story.tell(`the current generator becomes ${version}`);
				const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
				writeFileSync(manifestPath, JSON.stringify({ ...manifest, version }));
			},
			*update() {
				story.tell("the user runs create-app update in the app");
				yield* engine.source.pack();
				return yield* runCli(engine.root, engine.cli, true, ["update"], environment, target);
			},
		};
	},
});
