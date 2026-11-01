import { readdirSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Cause, Effect, Exit, Fiber, type FileSystem, type Layer, Order, Queue } from "effect";
import { TestClock } from "effect/testing";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { HomeMissing, homeIn } from "#server/files/home.ts";
import { listMarkdown } from "#server/files/list.ts";
import { watchDirectories } from "#server/files/watchDirectories.ts";
import { isWatchSentinel, READINESS_WITHIN } from "#server/files/watchSentinel.ts";
import { type Folder, folder } from "./board.ts";
import { unlinkBeforeStat } from "./fileRaces.ts";

interface FileReader {
	link?: () => void;
	notes: Folder;
	notify?: (path: string) => Effect.Effect<unknown>;
	readonly published: Queue.Queue<readonly string[]>;
	readonly sentinelWrites: Queue.Queue<string>;
	services: Layer.Layer<FileSystem.FileSystem>;
	readonly warnings: string[];
	watch?: Fiber.Fiber<unknown, unknown>;
	readonly watching: Queue.Queue<void>;
}

function running(engine: FileReader) {
	if (!engine.watch) {
		throw new Error("The host has not started watching");
	}
	return engine.watch;
}

export const fileReadingStory = storyKit({
	clock: "live",
	*create() {
		const notes = yield* Effect.acquireRelease(
			Effect.sync(() => folder({})),
			(acquired) => Effect.sync(acquired.remove),
		);
		const engine: FileReader = {
			notes,
			published: yield* Queue.unbounded<readonly string[]>(),
			sentinelWrites: yield* Queue.unbounded<string>(),
			services: NodeServices.layer,
			warnings: [],
			watching: yield* Queue.unbounded<void>(),
		};
		return engine;
	},
	inspect: (engine) => ({ root: engine.notes.root }),
	layer: NodeServices.layer,
	name: "board files",
	stages: ["project"],
	verbs: (engine, story) => ({
		edited: (file: string, source: string) => {
			story.tell(`an outside editor writes ${file}`);
			return Effect.sync(() => engine.notes.write(file, source));
		},
		homeSelection: (file: string) => {
			story.tell(`the board selects ${file} as home`);
			return homeIn(engine.notes.root, file).pipe(
				Effect.provide(engine.services),
				Effect.match({
					onFailure: (failure) => (failure instanceof HomeMissing ? `home missing: ${failure.message}` : `failed: ${String(failure)}`),
					onSuccess: () => "selected",
				}),
			);
		},
		linkFolder: () => {
			story.tell("the reader links a separate folder into the workspace");
			return Effect.sync(() => {
				if (!engine.link) {
					throw new Error("The story has no folder to link");
				}
				engine.link();
			});
		},
		listedPaths: () =>
			Effect.map(listMarkdown(engine.notes.root, engine.notes.root).pipe(Effect.provide(engine.services)), (files) => {
				story.tell("the board lists Markdown files");
				return files.map((file) => file.path);
			}),
		publishedPaths: () => {
			story.tell("the reader receives the next live file change");
			return Queue.take(engine.published);
		},
		readinessWindowPasses: () => {
			story.tell(`${READINESS_WITHIN} pass without the watcher reporting its sentinel`);
			return TestClock.adjust(READINESS_WITHIN);
		},
		get root() {
			return engine.notes.root;
		},
		sentinelWarnings: () => {
			story.tell("the reader reads the host's sentinel warnings");
			return Effect.sync(() => [...engine.warnings]);
		},
		sentinelWritten: () => {
			story.tell("the host writes its watch sentinel into the workspace");
			return Effect.asVoid(Queue.take(engine.sentinelWrites));
		},
		startWatching: Effect.fn("Story.startWatching")(function* () {
			story.tell("the host starts watching the workspace");
			engine.watch = yield* watchDirectories(engine.notes.root, engine.notes.root, {
				listed: () => Effect.void,
				publish: (paths) => Queue.offer(engine.published, paths),
				setWatching: (watching) => (watching ? Queue.offer(engine.watching, undefined) : Effect.void),
				stale: Effect.void,
			}).pipe(Effect.provide(engine.services), Effect.forkScoped);
		}),
		stopWatching: () => {
			story.tell("the host stops watching the workspace");
			return Fiber.interrupt(running(engine));
		},
		watcherReports: (path: string) => {
			story.tell(`the filesystem reports a change to ${path}`);
			if (!engine.notify) {
				throw new Error("The story has no controlled watcher notifications");
			}
			return engine.notify(path);
		},
		watchFailure: Effect.fn("Story.watchFailure")(function* () {
			const exit = yield* Fiber.await(running(engine));
			const failure = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined;
			return failure instanceof ServiceUnavailable ? `unavailable: ${failure.message}` : String(failure);
		}),
		watchStarted: () => {
			story.tell("the host waits until it is watching the workspace");
			return Effect.raceFirst(Queue.take(engine.watching), Fiber.join(running(engine)));
		},
		watchUntilItEnds: () => {
			story.tell("the host watches the workspace until the watch ends");
			return watchDirectories(engine.notes.root, engine.notes.root, {
				listed: () => Effect.void,
				publish: () => Effect.void,
				setWatching: () => Effect.void,
				stale: Effect.void,
			}).pipe(
				Effect.provide(engine.services),
				Effect.match({
					onFailure: (failure) => (failure instanceof ServiceUnavailable ? `unavailable: ${failure.message}` : `failed: ${String(failure)}`),
					onSuccess: () => "ended quietly",
				}),
			);
		},
		workspaceEntries: () =>
			Effect.sync(() => {
				story.tell("the reader lists the workspace folder");
				return readdirSync(engine.notes.root)
					.toSorted(Order.String)
					.map((entry) => (isWatchSentinel(entry) ? "a watch sentinel" : entry));
			}),
	}),
});
export function readableFiles(files: Readonly<Record<string, string>>) {
	return fileReadingStory.trait("project", "the workspace contains readable Markdown", (engine) => {
		for (const [file, source] of Object.entries(files)) {
			engine.notes.write(file, source);
		}
	});
}
export function disappearsBeforeStat(file: string) {
	return fileReadingStory.trait("project", `${file} disappears between resolution and stat`, (engine) => {
		engine.services = unlinkBeforeStat(join(engine.notes.root, file));
	});
}
