import * as NodeServices from "@effect/platform-node/NodeServices";
import { ConfigProvider, Effect, FileSystem, Option, Path, Queue } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { AppViteOptions } from "#adapters/appViteConfig.ts";
import { writeAtomically } from "#files.ts";
import { generate } from "#generate.ts";
import { emptyProject, generatedOncePerFile, vitestRun, writeFiles } from "#test/fixtureProject.ts";
import { NOTES_PROJECT } from "#test/notesProject.ts";
import { REFUSING_PROJECT } from "#test/refusingProject.ts";
import { VITE_PROJECT } from "#test/viteProject.ts";
import { appConfigBuild, type DevServer, viteBuild, viteDevServer } from "#test/viteRuns.ts";

interface ViteEngine {
	devServer: Option.Option<DevServer>;
	readonly edited: Set<string>;
	readonly lock: string;
	readonly root: string;
}

// Only the story's lock file, so the lock is taken even on CI, where a set CI variable skips it.
function onlyTheStoryLock(engine: ViteEngine) {
	return Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { "HEAVY_PROCESS_LOCK": engine.lock } }));
}

const runningDevServer = Effect.fn("BuildStory.runningDevServer")(function* (engine: ViteEngine) {
	return Option.isSome(engine.devServer) ? engine.devServer.value : yield* Effect.die(new Error("no dev server is running"));
});

export const vite = storyKit({
	*create() {
		const root = yield* emptyProject();
		const path = yield* Path.Path;
		const engine: ViteEngine = { devServer: Option.none(), edited: new Set(), lock: path.join(root, "heavy-process.lock"), root };
		return engine;
	},
	inspect: ({ root }) => ({ root }),
	layer: NodeServices.layer,
	name: "vite",
	stages: ["project", "generated", "page"],
	verbs: (engine, story) => ({
		browserLoadsThePage: Effect.fn("BuildStory.browserLoadsThePage")(function* () {
			story.tell("the browser loads the page's script and the generated client it imports");
			const { url } = yield* runningDevServer(engine);
			const answers = yield* Effect.forEach(["/src/client.ts", "/src/generated/modules/notes/notes.ts"], (file) =>
				Effect.promise(() => fetch(`${url}${file}`).then((response) => response.text().then(() => response.ok))),
			);
			return answers.every(Boolean) ? "loaded" : "failed";
		}),
		// macOS reports the fixture's own writes from just before the watcher started, and Vite reloads the page for them; those
		// reloads answer no edit of the story, so the browser's next answer to an edit is the first reload one caused.
		browserReceives: Effect.fn("BuildStory.browserReceives")(function* () {
			const { browser } = yield* runningDevServer(engine);
			const path = yield* Path.Path;
			for (;;) {
				const message = yield* Queue.take(browser);
				if ("overlay" in message) {
					return message;
				}
				if (engine.edited.has(message.reloadAfter)) {
					return { reloadAfter: path.relative(engine.root, message.reloadAfter) };
				}
			}
		}),
		builds: (...serverOnly: readonly string[]) => {
			story.tell(
				serverOnly.length === 0
					? "the application runs vite build"
					: `the application runs vite build with ${serverOnly.join(", ")} listed as server-only`,
			);
			return viteBuild(engine.root, serverOnly);
		},
		buildsWithTheAppConfig: (options: AppViteOptions = {}) => {
			story.tell(`the application runs vite build with appViteConfig and ${JSON.stringify(options)}`);
			return appConfigBuild(engine.root, options);
		},
		createsTheTagsModule: Effect.fn("BuildStory.createsTheTagsModule")(function* () {
			const { path: file, text } = VITE_PROJECT.tagsModule;
			story.tell(`the developer creates ${file}, which defines the tags module`);
			const path = yield* Path.Path;
			engine.edited.add(path.join(engine.root, file));
			yield* writeAtomically(path.join(engine.root, file), text);
		}),
		edits: Effect.fn("BuildStory.edits")(function* (file: string, from: string, to: string) {
			story.tell(`the developer changes ${from} to ${to} in ${file}`);
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const text = yield* fs.readFileString(path.join(engine.root, file));
			if (!text.includes(from)) {
				return yield* Effect.die(new Error(`${file} does not contain ${from}`));
			}
			engine.edited.add(path.join(engine.root, file));
			yield* writeAtomically(path.join(engine.root, file), text.replace(from, to));
		}),
		generatedFile: Effect.fn("BuildStory.generatedFile")(function* (file: string) {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const full = path.join(engine.root, file);
			return (yield* fs.exists(full)) ? yield* fs.readFileString(full) : "missing";
		}),
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
				onlyTheStoryLock(engine),
			),
	}),
});

export function notesApplication() {
	return vite.trait("project", "the project has the notes module and a page whose script imports its generated client", (engine) =>
		writeFiles(engine.root, { ...NOTES_PROJECT, ...VITE_PROJECT.notesPage }),
	);
}

export function generatedOnce() {
	return vite.trait("generated", "generate has written the project's files", (engine) =>
		generatedOncePerFile(engine.root, generate(engine.root, { check: false }).pipe(onlyTheStoryLock(engine))),
	);
}

export function screenImportingTheModule() {
	return vite.trait("page", "the page's notes screen imports the notes module instead of its generated client", (engine) =>
		writeFiles(engine.root, VITE_PROJECT.screenImportingTheModule),
	);
}

export function pageImportingTheTagsClient() {
	return vite.trait(
		"page",
		"the page's script also imports the generated client of a tags module whose folder exists and whose module file does not exist yet",
		Effect.fn("BuildStory.pageImportingTheTagsClient")(function* (engine: ViteEngine) {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			yield* writeFiles(engine.root, VITE_PROJECT.pageImportingTheTagsClient);
			yield* fs.makeDirectory(path.dirname(path.join(engine.root, VITE_PROJECT.tagsModule.path)), { recursive: true });
		}),
	);
}

export function pageImporting(kind: keyof typeof VITE_PROJECT.serverCodePages) {
	return vite.trait("page", `the page's script imports ${kind}`, (engine) => writeFiles(engine.root, VITE_PROJECT.serverCodePages[kind]));
}

export function notesTest() {
	return vite.trait("page", "the project has a test file that imports the generated notes wire", (engine) =>
		writeFiles(engine.root, VITE_PROJECT.notesTest),
	);
}

export function notesTestThroughTheAppConfig() {
	return vite.trait("page", "the project has a test file that imports the generated notes wire and a vitest config made by appTestConfig", (engine) =>
		writeFiles(engine.root, VITE_PROJECT.notesTestThroughTheAppConfig),
	);
}

export function refusedModule() {
	return vite.trait("project", "the project also has the refused module, whose operations the wire cannot carry exactly", (engine) =>
		writeFiles(engine.root, Object.fromEntries(Object.entries(REFUSING_PROJECT).filter(([file]) => file.startsWith("src/")))),
	);
}
