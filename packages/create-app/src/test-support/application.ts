import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Config, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { CreateAppError } from "#CreateAppError.ts";
import { scriptOutcome } from "./answers.ts";
import { appReadouts } from "./appReadouts.ts";
import { appFolder } from "./cli.ts";
import { commandTiming } from "./commandTiming.ts";
import { createEngine } from "./createEngine.ts";
import { appScript, installDatabaseProbe, readyAgainstWorkspace } from "./environment.ts";
import { createAppIn } from "./generate.ts";
import { generatedReadouts } from "./generatedReadouts.ts";
import { runAdminStories } from "./runAdminStories.ts";
import { templateReadouts } from "./templateReadouts.ts";

export type Flag = "--minimal" | "--no-git";

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
	inspect: (engine) => ({ answers: engine.answers, app: engine.app, options: engine.options, root: engine.root }),
	layer: NodeServices.layer,
	name: "generated app",
	stages: ["template", "installation", "workspace", "generated", "app"],
	verbs: (engine, story) => {
		const commandPath = Effect.runSync(Config.String("PATH"));
		function target() {
			return join(engine.root, engine.app);
		}
		function script(line: string, run: () => Parameters<typeof scriptOutcome>[0]) {
			return Effect.sync(() => {
				story.tell(line);
				const outcome = scriptOutcome(run());
				engine.scripts.push(outcome);
				return outcome;
			});
		}
		return {
			...appReadouts(target),
			...generatedReadouts(engine, target),
			...templateReadouts(engine),
			answer: () => Effect.sync(() => engine.answers.at(-1) ?? "create-app has not run"),
			createApp: (folder: string, ...flags: readonly Flag[]) => {
				story.tell(`create-app ${[folder, ...flags].join(" ")}`);
				return createAppIn(engine, [folder, ...flags]);
			},
			diagnosticLog: () => Effect.sync(() => engine.diagnostics),
			help: () => {
				story.tell("create-app --help");
				return createAppIn(engine, ["--help"]).pipe(Effect.map(() => engine.printed.split("\n").map((line) => line.trim().replaceAll(/\s+/gu, " "))));
			},
			migrate: () =>
				script("the app applies its registered migrations", () => appScript(target(), "migrate", [], ["NODE_OPTIONS=--conditions=source"])),
			pack: () =>
				Effect.suspend(() => {
					story.tell("the template source is packed");
					return engine.source.pack();
				}).pipe(
					Effect.map(() => "packed"),
					Effect.catchTag("CreateAppError", (error) =>
						Effect.succeed(`refused: ${error.message}${error.cause instanceof CreateAppError ? `: ${error.cause.message}` : ""}`),
					),
				),
			pnpm: (...args: readonly string[]) =>
				script(`pnpm ${args.join(" ")}`, () => {
					const started = performance.now();
					const result = spawnSync(
						"env",
						["NODE_OPTIONS=", `PATH=${join(engine.root, "bin")}:${commandPath}`, ...engine.environment, "pnpm", ...args],
						{
							cwd: target(),
							encoding: "utf8",
						},
					);
					commandTiming(`pnpm ${args.join(" ")}`, started, result.stderr);
					return result;
				}),
			ready: () => script("the app runs pnpm ready against workspace packages", () => readyAgainstWorkspace(target(), engine.source.starter)),
			runAdminStories: () => script("the app runs its admin stories against workspace sources", () => runAdminStories(target(), false)),
			runDatabaseProbe: () =>
				script("the app runs a test that records its environment and both databases", () => {
					installDatabaseProbe(target());
					return appScript(target(), "test", ["--config", "environment.config.ts"]);
				}),
			runFoundationAdminStories: () =>
				script("the app runs its foundation admin stories against workspace sources", () => runAdminStories(target(), true)),
			scriptResult: () => Effect.sync(() => engine.scripts.at(-1) ?? "the app ran no script"),
			version: () => {
				story.tell("create-app --version");
				return createAppIn(engine, ["--version"]).pipe(Effect.map(() => engine.printed.trim()));
			},
		};
	},
});
