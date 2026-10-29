import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, readlinkSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Config, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appFolder, runCli } from "./cli.ts";
import { createEngine } from "./createEngine.ts";
import { appScript, installDatabaseProbe, readyAgainstWorkspace } from "./environment.ts";
import { runAdminStories } from "./runAdminStories.ts";

export const application = storyKit({
	after: {
		*installation(engine) {
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
		const commandPath = Effect.runSync(Config.String("PATH"));
		let app = "my-app";
		let packed = false;
		function target() {
			return join(engine.root, app);
		}
		function run(command: string, args: readonly string[]) {
			return spawnSync("env", ["NODE_OPTIONS=", `PATH=${join(engine.root, "bin")}:${commandPath}`, ...engine.environment, command, ...args], {
				cwd: target(),
				encoding: "utf8",
			});
		}
		return {
			baseline: () => {
				const path = join(target(), "quality-baseline.jsonl");
				return existsSync(path) ? readFileSync(path, "utf8") : "";
			},
			changeTemplate: (content: string) => {
				story.tell("the template source changes");
				engine.source.changeApp(content);
				packed = false;
			},
			*cli(args: readonly string[], environment: readonly string[] = []) {
				story.tell(`create-app ${args.join(" ")}`);
				if (!(packed || args.includes("--help") || args.includes("--version"))) {
					yield* engine.source.pack();
					packed = true;
				}
				if (args[0] !== undefined && !args[0].startsWith("--")) {
					app = args[0];
				}
				return yield* runCli(engine.root, engine.cli, engine.options.gitAvailable ?? true, args, [...engine.environment, ...environment]);
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
			git: (...args: readonly string[]) => run("git", args),
			guidanceLink: () => readlinkSync(join(target(), "CLAUDE.md")),
			migrate: () => {
				story.tell("the generated app applies its registered migrations");
				return appScript(target(), "migrate", [], ["NODE_OPTIONS=--conditions=source"]);
			},
			navigate: (command: string) => spawnSync("sh", ["-c", `${command}\npwd`], { cwd: engine.root, encoding: "utf8" }),
			pack: () => {
				story.tell("the template source is packed");
				return engine.source.pack().pipe(
					Effect.map((files) => {
						packed = true;
						return files;
					}),
				);
			},
			parentGit: (...args: readonly string[]) => spawnSync("git", args, { cwd: engine.root, encoding: "utf8" }),
			pnpm: (...args: readonly string[]) => {
				story.tell(`pnpm ${args.join(" ")}`);
				return run("pnpm", args);
			},
			prepareDatabases: () => {
				story.tell("the app prepares its databases");
				return appScript(target(), "db:setup");
			},
			read: (path: string) => readFileSync(join(target(), path), "utf8"),
			readPacked: (path: string) => engine.source.readPacked(path),
			ready: () => {
				story.tell("the generated app runs pnpm ready against workspace packages");
				return readyAgainstWorkspace(target(), engine.source.starter);
			},
			runAdminStories: () => {
				story.tell("the generated app runs its admin stories against workspace sources");
				return runAdminStories(target());
			},
			runDatabaseProbe: () => {
				story.tell("the app runs the database probe");
				installDatabaseProbe(target());
				return appScript(target(), "test", ["--config", "environment.config.ts"]);
			},
			starterFile: (path: string) => readFileSync(join(engine.source.starter, path), "utf8"),
			workspace: realpathSync(engine.root),
			workspaceExists: (path: string) => existsSync(join(engine.root, path)),
			workspaceFiles: () => readdirSync(engine.root),
			write: (path: string, content: string) => {
				story.tell(`the app changes ${path}`);
				writeFileSync(join(target(), path), content);
			},
		};
	},
});
