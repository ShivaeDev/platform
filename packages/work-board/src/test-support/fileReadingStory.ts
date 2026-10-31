import { readdirSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Cause, Deferred, Effect, Exit, Fiber, FileSystem, Layer, Queue, Stream } from "effect";
import { TestClock } from "effect/testing";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { homeIn } from "#server/files/home.ts";
import { listMarkdown } from "#server/files/list.ts";
import { watchDirectories } from "#server/files/watchDirectories.ts";
import { isWatchSentinel, READINESS_WITHIN } from "#server/files/watchSentinel.ts";
import { type Folder, folder } from "./board.ts";
import { unlinkBeforeStat } from "./fileRaces.ts";

interface FileReader {
	notes: Folder;
	readonly published: Queue.Queue<readonly string[]>;
	readonly sentinelWrites: Queue.Queue<string>;
	services: Layer.Layer<FileSystem.FileSystem>;
	watch?: Fiber.Fiber<unknown, unknown>;
	readonly watching: Deferred.Deferred<void>;
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
			watching: yield* Deferred.make<void>(),
		};
		return engine;
	},
	inspect: (engine) => ({ root: engine.notes.root }),
	layer: NodeServices.layer,
	name: "board files",
	stages: ["project"],
	verbs: (engine, story) => ({
		edited: Effect.fn("Story.edited")(function* (file: string, source: string) {
			story.tell(`an editor writes ${file} and the watch publishes it`);
			engine.notes.write(file, source);
			yield* Queue.take(engine.published).pipe(Effect.repeat({ until: (paths) => paths.includes(file) }));
		}),
		listFiles: () => {
			story.tell("the board lists Markdown files");
			return listMarkdown(engine.notes.root, engine.notes.root).pipe(Effect.provide(engine.services));
		},
		readinessWindowPasses: () => {
			story.tell(`${READINESS_WITHIN} pass without the watcher reporting its sentinel`);
			return TestClock.adjust(READINESS_WITHIN);
		},
		get root() {
			return engine.notes.root;
		},
		selectHome: (file: string) => {
			story.tell(`the board selects ${file} as home`);
			return homeIn(engine.notes.root, file).pipe(Effect.provide(engine.services));
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
				setWatching: (watching) => (watching ? Deferred.succeed(engine.watching, undefined) : Effect.void),
				stale: Effect.void,
			}).pipe(Effect.provide(engine.services), Effect.forkScoped);
		}),
		stopWatching: () => {
			story.tell("the host stops watching the workspace");
			return Fiber.interrupt(running(engine));
		},
		watchDirectory: () => {
			story.tell("the host starts watching the workspace");
			return watchDirectories(engine.notes.root, engine.notes.root, {
				listed: () => Effect.void,
				publish: () => Effect.void,
				setWatching: () => Effect.void,
				stale: Effect.void,
			}).pipe(Effect.provide(engine.services));
		},
		watchFailure: Effect.fn("Story.watchFailure")(function* () {
			const exit = yield* Fiber.await(running(engine));
			const failure = Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined;
			return failure instanceof ServiceUnavailable ? `unavailable: ${failure.message}` : String(failure);
		}),
		watchStarted: () => {
			story.tell("the host waits until it is watching the workspace");
			return Effect.raceFirst(Deferred.await(engine.watching), Fiber.join(running(engine)));
		},
		workspaceEntries: () => readdirSync(engine.notes.root).toSorted(),
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
export function anEndedWatcher() {
	return fileReadingStory.trait("project", "the filesystem watcher ends without an error", (engine) => {
		engine.services = Layer.effect(
			FileSystem.FileSystem,
			Effect.map(FileSystem.FileSystem, (fs) => ({ ...fs, watch: () => Stream.empty })),
		).pipe(Layer.provide(NodeServices.layer));
	});
}
export function aSilentWatcher() {
	return fileReadingStory.trait("project", "the filesystem watcher starts but never reports a change", (engine) => {
		engine.services = Layer.effect(
			FileSystem.FileSystem,
			Effect.map(FileSystem.FileSystem, (fs) => ({
				...fs,
				watch: () => Stream.never,
				writeFileString: (path, data, options) =>
					fs
						.writeFileString(path, data, options)
						.pipe(Effect.tap(() => (isWatchSentinel(path) ? Queue.offer(engine.sentinelWrites, path) : Effect.void))),
			})),
		).pipe(Layer.provide(NodeServices.layer));
	});
}
