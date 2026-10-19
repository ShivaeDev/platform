import { realpathSync } from "node:fs";
import { relative } from "node:path";
import { Deferred, Effect, PlatformError, Semaphore } from "effect";
import { boardStory } from "./boardStory.ts";
import { type BoardEngine, type WorkspaceReads, wrapFilesystem } from "./storyEngine.ts";

export function recordedReads(held = false) {
	return boardStory.trait("project", held ? "workspace file reads wait until released" : "the board records the files it reads", (engine) => {
		recordReads(engine, held ? { files: [], gate: Deferred.makeUnsafe<void>() } : { files: [] });
	});
}

export function readsOneByOne() {
	return boardStory.trait("project", "workspace file reads wait to be released one at a time", (engine) => {
		recordReads(engine, { files: [], gate: Deferred.makeUnsafe<void>(), permits: Semaphore.makeUnsafe(0) });
	});
}

export function heldWorkspaceListing() {
	return boardStory.trait("project", "listing the workspace for the index waits until released", (engine) => {
		const reads: WorkspaceReads = { files: [], gate: Deferred.makeUnsafe<void>() };
		engine.reads = reads;
		wrapFilesystem(engine, (fs) => ({
			...fs,
			// Only the index's listing checks the root itself; the watcher lists its children.
			stat: (path) =>
				path === realpathSync(engine.notes.root) && reads.gate ? Effect.andThen(Deferred.await(reads.gate), fs.stat(path)) : fs.stat(path),
		}));
	});
}

function recordReads(engine: BoardEngine, reads: WorkspaceReads) {
	engine.reads = reads;
	wrapFilesystem(engine, (fs) => ({
		...fs,
		readFileString: (path, encoding) =>
			Effect.suspend(() => {
				reads.files.push(relative(engine.notes.root, path));
				const read = fs.readFileString(path, encoding);
				return reads.gate ? Effect.andThen(released(reads.gate, reads.permits), read) : read;
			}),
	}));
}

function released(gate: Deferred.Deferred<void>, permits: Semaphore.Semaphore | undefined) {
	return permits ? Effect.raceFirst(Deferred.await(gate), permits.take(1)) : Deferred.await(gate);
}

export function unlistableWorkspace() {
	return boardStory.trait("project", "the workspace folders cannot be listed", (engine) => {
		wrapFilesystem(engine, (fs) => ({
			...fs,
			readDirectory: () => Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readDirectory", module: "FileSystem" })),
		}));
	});
}
