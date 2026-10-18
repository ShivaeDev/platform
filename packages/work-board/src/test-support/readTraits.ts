import { relative } from "node:path";
import { Deferred, Effect, PlatformError } from "effect";
import { boardStory } from "./boardStory.ts";
import { type WorkspaceReads, wrapFilesystem } from "./storyEngine.ts";

export function noReader() {
	return boardStory.trait("project", "nobody opens the board or connects a client", (engine) => {
		engine.reader = false;
	});
}

export function recordedReads(held = false) {
	return boardStory.trait("project", held ? "workspace file reads wait until released" : "the board records the files it reads", (engine) => {
		const files: string[] = [];
		const reads: WorkspaceReads = held ? { files, gate: Deferred.makeUnsafe<void>() } : { files };
		engine.reads = reads;
		wrapFilesystem(engine, (fs) => ({
			...fs,
			readFileString: (path, encoding) =>
				Effect.suspend(() => {
					reads.files.push(relative(engine.notes.root, path));
					const read = fs.readFileString(path, encoding);
					return reads.gate ? Effect.andThen(Deferred.await(reads.gate), read) : read;
				}),
		}));
	});
}

export function unlistableWorkspace() {
	return boardStory.trait("project", "the workspace folders cannot be listed", (engine) => {
		wrapFilesystem(engine, (fs) => ({
			...fs,
			readDirectory: () => Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readDirectory", module: "FileSystem" })),
		}));
	});
}
