import * as NodeServices from "@effect/platform-node/NodeServices";
import { ConfigProvider, Effect, FileSystem, Option, Path, Queue } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { generate } from "#generate.ts";
import { emptyProject, vitestRun, writeFiles } from "#test/fixtureProject.ts";
import { NOTES_PROJECT } from "#test/notesProject.ts";
import { REFUSING_PROJECT } from "#test/refusingProject.ts";
import { NOTES_PAGE, NOTES_TEST, SCREEN_IMPORTING_THE_MODULE, SERVER_CODE_PAGES } from "#test/viteProject.ts";
import { type DevServer, viteBuild, viteDevServer } from "#test/viteRuns.ts";

interface ViteEngine {
	devServer: Option.Option<DevServer>;
	readonly lock: string;
	readonly root: string;
}

const runningDevServer = Effect.fn("BuildStory.runningDevServer")(function* (engine: ViteEngine) {
	return Option.isSome(engine.devServer) ? engine.devServer.value : yield* Effect.die(new Error("no dev server is running"));
});

export const vite = storyKit({
	*create() {
		const root = yield* emptyProject();
		const path = yield* Path.Path;
		const engine: ViteEngine = { devServer: Option.none(), lock: path.join(root, "heavy-process.lock"), root };
		return engine;
	},
	inspect: ({ root }) => ({ root }),
	layer: NodeServices.layer,
	name: "vite",
	stages: ["project", "page"],
	verbs: (engine, story) => ({
		browserLoadsThePage: Effect.fn("BuildStory.browserLoadsThePage")(function* () {
			story.tell("the browser loads the page's script and the generated client it imports");
			const { url } = yield* runningDevServer(engine);
			for (const file of ["/src/client.ts", "/src/generated/modules/notes/notes.ts"]) {
				yield* Effect.promise(() => fetch(`${url}${file}`).then((response) => response.text()));
			}
		}),
		browserReceives: Effect.fn("BuildStory.browserReceives")(function* () {
			const { browser } = yield* runningDevServer(engine);
			return yield* Queue.take(browser);
		}),
		builds: (...serverOnly: readonly string[]) => {
			story.tell(
				serverOnly.length === 0
					? "the application runs vite build"
					: `the application runs vite build with ${serverOnly.join(", ")} listed as server-only`,
			);
			return viteBuild(engine.root, serverOnly);
		},
		edits: Effect.fn("BuildStory.edits")(function* (file: string, from: string, to: string) {
			story.tell(`the developer changes ${from} to ${to} in ${file}`);
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const text = yield* fs.readFileString(path.join(engine.root, file));
			if (!text.includes(from)) {
				return yield* Effect.die(new Error(`${file} does not contain ${from}`));
			}
			yield* fs.writeFileString(path.join(engine.root, file), text.replace(from, to));
		}),
		generatedFile: Effect.fn("BuildStory.generatedFile")(function* (file: string) {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const full = path.join(engine.root, file);
			return (yield* fs.exists(full)) ? yield* fs.readFileString(full) : "missing";
		}),
		// Whether the next request for the module transforms it again, as Vite's module graph records it.
		moduleGraphEntry: Effect.fn("BuildStory.moduleGraphEntry")(function* (file: string) {
			const { server } = yield* runningDevServer(engine);
			const path = yield* Path.Path;
			const module = server.environments.client.moduleGraph.getModuleById(path.join(engine.root, file));
			if (module === undefined) {
				return "not loaded";
			}
			return module.transformResult === null ? "invalidated" : "transformed";
		}),
		runsVitest: () => {
			story.tell("the application runs vitest");
			return vitestRun(engine.root, engine.lock);
		},
		runsVitestTwiceAtOnce: () => {
			story.tell("two vitest runs start on the project at once");
			return Effect.all([vitestRun(engine.root, engine.lock), vitestRun(engine.root, engine.lock)], { concurrency: 2 });
		},
		startsTheDevServer: Effect.fn("BuildStory.startsTheDevServer")(function* () {
			story.tell("the developer starts the vite dev server and the browser connects to it");
			return yield* viteDevServer(engine.root).pipe(
				Effect.map((devServer) => {
					engine.devServer = Option.some(devServer);
					return "started" as const;
				}),
				Effect.catch((failure) => Effect.succeed(failure)),
			);
		}),
		terminalErrors: Effect.fn("BuildStory.terminalErrors")(function* () {
			return (yield* runningDevServer(engine)).terminal;
		}),
		upToDate: () =>
			generate(engine.root, { check: true }).pipe(
				Effect.as("every generated file is up to date"),
				Effect.catchTag("GenerateFailed", (failed) => Effect.succeed(failed.problems.join("\n"))),
				Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { "HEAVY_PROCESS_LOCK": engine.lock } })),
			),
	}),
});

export function notesApplication() {
	return vite.trait("project", "the project has the notes module and a page whose script imports its generated client", (engine) =>
		writeFiles(engine.root, { ...NOTES_PROJECT, ...NOTES_PAGE }),
	);
}

export function screenImportingTheModule() {
	return vite.trait("page", "the page's notes screen imports the notes module instead of its generated client", (engine) =>
		writeFiles(engine.root, SCREEN_IMPORTING_THE_MODULE),
	);
}

export function pageImporting(kind: keyof typeof SERVER_CODE_PAGES) {
	return vite.trait("page", `the page's script imports ${kind}`, (engine) => writeFiles(engine.root, SERVER_CODE_PAGES[kind]));
}

export function notesTest() {
	return vite.trait("page", "the project has a test file that imports the generated notes wire", (engine) => writeFiles(engine.root, NOTES_TEST));
}

export function refusedModule() {
	return vite.trait("project", "the project also has the refused module, whose operations the wire cannot carry exactly", (engine) =>
		writeFiles(engine.root, Object.fromEntries(Object.entries(REFUSING_PROJECT).filter(([file]) => file.startsWith("src/")))),
	);
}
