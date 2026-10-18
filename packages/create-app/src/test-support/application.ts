import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, readlinkSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { appFolder, runCli } from "./cli.ts";
import { createEngine } from "./createEngine.ts";
import { testEnvironment } from "./environment.ts";

export const application = storyKit({
	after: {
		*installation(engine) {
			yield* engine.source.pack();
			yield* Effect.sync(() => appFolder(engine.root, engine.options));
		},
	},
	clock: "live",
	*create() {
		return yield* createEngine();
	},
	inspect: (engine) => ({ options: engine.options, root: engine.root }),
	layer: NodeServices.layer,
	name: "generated app",
	stages: ["template", "installation", "workspace"],
	verbs: (engine, story) => {
		let app = "my-app";
		function target() {
			return join(engine.root, app);
		}
		return {
			changeTemplate: (content: string) => {
				story.tell("the template source changes");
				engine.source.changeApp(content);
			},
			*checkDatabases() {
				story.tell("the app prepares its databases and runs its tests");
				const fixture = testEnvironment(target(), { databases: true, name: app });
				return yield* Effect.sync(() => ({ setup: fixture.prepareDatabases(), test: fixture.run() }));
			},
			cli: (args: readonly string[], environment: readonly string[] = []) => {
				story.tell(`create-app ${args.join(" ")}`);
				if (args[0] !== undefined && !args[0].startsWith("--")) {
					app = args[0];
				}
				return runCli(engine.root, engine.cli, engine.options.gitAvailable ?? true, args, [...engine.environment, ...environment]);
			},
			destinationContents: () =>
				statSync(target()).isFile()
					? { ".": readFileSync(target(), "utf8") }
					: Object.fromEntries(readdirSync(target()).map((file) => [file, readFileSync(join(target(), file), "utf8")])),
			exists: (path: string) => existsSync(join(target(), path)),
			files: () => readdirSync(target()),
			generatedFiles: () =>
				readdirSync(target(), { recursive: true, withFileTypes: true })
					.filter((file) => !(file.isDirectory() || file.isSymbolicLink()) && file.name !== "installation.json")
					.map((file) => {
						const path = join(file.parentPath, file.name);
						return { content: readFileSync(path, "utf8"), mode: statSync(path).mode & 0o777, path: path.slice(target().length + 1) };
					}),
			git: (...args: readonly string[]) => spawnSync("git", args, { cwd: target(), encoding: "utf8" }),
			guidanceLink: () => readlinkSync(join(target(), "CLAUDE.md")),
			navigate: (command: string) => ({
				...spawnSync("sh", ["-c", `${command}\npwd`], { cwd: engine.root, encoding: "utf8" }),
				expected: join(realpathSync(engine.root), app),
			}),
			pack: () => {
				story.tell("the template source is packed");
				return engine.source.pack();
			},
			parentGit: (...args: readonly string[]) => spawnSync("git", args, { cwd: engine.root, encoding: "utf8" }),
			read: (path: string) => readFileSync(join(target(), path), "utf8"),
			starterFile: (path: string) => readFileSync(join(engine.source.starter, path), "utf8"),
			workspaceExists: (path: string) => existsSync(join(engine.root, path)),
			workspaceFiles: () => readdirSync(engine.root),
		};
	},
});
