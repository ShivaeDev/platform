import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { cliAnswer } from "#test/answers.ts";
import { appReadouts } from "#test/appReadouts.ts";
import { appFolder, runCli } from "#test/cli.ts";
import { createEngine } from "#test/createEngine.ts";
import { releases } from "#test/releases.ts";
import { templateSource } from "#test/templateSource.ts";
import { gitIn } from "#test/tools.ts";
import { updateProcesses, updateTypecheck } from "#test/updateProcesses.ts";

const decodeManifest = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)));

export const updates = storyKit({
	*create() {
		const engine = yield* createEngine();
		const original = engine.source.starter;
		engine.source = templateSource(dirname(dirname(engine.cli)));
		cpSync(original, engine.source.starter, {
			filter: (path) => !["node_modules", "dist", "coverage", ".env.local"].includes(path.split("/").at(-1) ?? ""),
			recursive: true,
		});
		const starterManifest = join(engine.source.starter, "package.json");
		const typecheck = updateTypecheck(engine.source.starter);
		appFolder(engine.root);
		const registry = yield* releases(dirname(engine.root));
		const manifest = join(dirname(dirname(engine.cli)), "package.json");
		const target = join(engine.root, "my-app");
		const environment = [
			...engine.environment,
			`npm_config_registry=${registry.origin}`,
			`npm_config_cache=${join(dirname(engine.root), "npm-cache")}`,
		];
		const processes = { installationError: "", result: { status: 0, stderr: "", stdout: "" } };
		return {
			...engine,
			generator: (version: string) => {
				writeFileSync(manifest, JSON.stringify({ ...decodeManifest(readFileSync(manifest, "utf8")), version }));
			},
			processes,
			publish: (version: string) => registry.publish(version, engine.source.output),
			run: (args: readonly string[], cwd: string) =>
				Effect.gen(function* () {
					if (args[0] === "update") {
						updateProcesses(engine.root, processes.installationError);
					}
					const starterPackage = JSON.parse(readFileSync(starterManifest, "utf8"));
					starterPackage.scripts.typecheck = typecheck;
					writeFileSync(starterManifest, JSON.stringify(starterPackage, null, "\t"));
					yield* engine.source.pack();
					processes.result = yield* runCli(engine.root, engine.cli, true, args, environment, cwd);
					return processes.result;
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
		exitCode: () => Effect.sync(() => engine.processes.result.status),
		printedMentions: (text: string) => Effect.sync(() => engine.processes.result.stdout.includes(text)),
		repositoryFile: (path: string) => Effect.sync(() => readFileSync(join(engine.root, path), "utf8")),
		stagedRepositoryFile: (path: string) => Effect.sync(() => gitIn(engine.root, ["show", `:${path}`]).stdout),
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
