import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Config, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { CreateAppError } from "#CreateAppError.ts";
import { scriptOutcome } from "#test/answers.ts";
import { appReadouts } from "#test/appReadouts.ts";
import { appFolder } from "#test/cli.ts";
import { createEngine } from "#test/createEngine.ts";
import { appScript, installDatabaseProbe, workspaceConditions } from "#test/environment.ts";
import { createAppIn } from "#test/generate.ts";
import { generatedReadouts } from "#test/generatedReadouts.ts";
import { railwayReadouts } from "#test/railwayReadouts.ts";
import { resourceActions } from "#test/resourceActions.ts";
import { skillActions } from "#test/skillActions.ts";
import { templateReadouts } from "#test/templateReadouts.ts";
import { typecheckAgainstWorkspace } from "#test/typecheckAgainstWorkspace.ts";

export type Flag = "--minimal" | "--no-git";

export const application = storyKit({
	after: {
		*installation(engine) {
			yield* Effect.sync(() => appFolder(engine.root, engine.options));
		},
	},
	*create() {
		return yield* createEngine();
	},
	inspect: ({ answers, app, diagnostics, options, printed, root }) => ({ answers, app, diagnostics, options, printed, root }),
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
			...railwayReadouts(target),
			...resourceActions(engine, story),
			...generatedReadouts(engine, target),
			...templateReadouts(engine),
			...skillActions(target, story),
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
				script("the app applies its registered migrations", () =>
					appScript(target(), "migrate", [], ["NODE_OPTIONS=--conditions=@shivaedev/source"]),
				),
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
					const result = spawnSync(
						"env",
						[
							"NODE_OPTIONS=--conditions=@shivaedev/source",
							`PATH=${join(engine.root, "bin")}:${commandPath}`,
							...engine.environment,
							"pnpm",
							...args,
						],
						{
							cwd: target(),
							encoding: "utf8",
						},
					);
					return result;
				}),
			runDatabaseProbe: () =>
				script("the app generates its modules' files and runs a test that records its environment and both databases", () => {
					installDatabaseProbe(target());
					workspaceConditions(target(), engine.source.starter);
					// The probe's own Vitest config has no global setup, and a linked app never ran the install that generates.
					const generated = appScript(target(), "generate");
					return generated.status === 0 ? appScript(target(), "test", ["--config", "environment.config.ts"]) : generated;
				}),
			scriptResult: () => Effect.sync(() => engine.scripts.at(-1) ?? "the app ran no script"),
			typecheck: () => typecheckAgainstWorkspace(target(), engine.source.starter, story),
			version: () => {
				story.tell("create-app --version");
				return createAppIn(engine, ["--version"]).pipe(Effect.map(() => engine.printed.trim()));
			},
		};
	},
});
