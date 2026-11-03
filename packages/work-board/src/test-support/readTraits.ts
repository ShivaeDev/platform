import { realpathSync } from "node:fs";
import { relative } from "node:path";
import { Deferred, Effect, Option, PlatformError, Semaphore, Tracer } from "effect";
import { boardStory } from "#test/boardStory.ts";
import { type BoardEngine, type WorkspaceReads, wrapFilesystem } from "#test/storyEngine.ts";

export function recordedReads(held = false) {
	return boardStory.trait("project", held ? "workspace file reads wait until released" : "the board records the files it reads", (engine) => {
		recordReads(engine, held ? { answerFiles: [], files: [], gate: Deferred.makeUnsafe<void>() } : { answerFiles: [], files: [] });
	});
}

export function readsOneByOne() {
	return boardStory.trait("project", "workspace file reads wait to be released one at a time", (engine) => {
		recordReads(engine, { files: [], gate: Deferred.makeUnsafe<void>(), permits: Semaphore.makeUnsafe(0) });
	});
}

export function slowRepositoryLookup() {
	return boardStory.trait("project", "finding the repository's package.json and git folder waits until released", (engine) => {
		const gate = Deferred.makeUnsafe<void>();
		engine.repositoryLookup = gate;
		wrapFilesystem(engine, (fs) => ({
			...fs,
			exists: (path) => (/\/(?:package\.json|\.git)$/u.test(path) ? Effect.andThen(Deferred.await(gate), fs.exists(path)) : fs.exists(path)),
		}));
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
			Effect.gen(function* () {
				const file = relative(engine.notes.root, path);
				if (file === ".." || file.startsWith("../")) {
					return yield* fs.readFileString(path, encoding);
				}
				reads.files.push(file);
				if (answerRequest(yield* Effect.serviceOption(Tracer.ParentSpan))) {
					reads.answerFiles?.push(file);
				}
				const read = fs.readFileString(path, encoding);
				return yield* reads.gate ? Effect.andThen(released(reads.gate, reads.permits), read) : read;
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

function answerRequest(current: Option.Option<Tracer.AnySpan>) {
	let span = current;
	while (Option.isSome(span) && span.value._tag === "Span") {
		if (span.value.name.includes("answerQuestion")) {
			return true;
		}
		span = span.value.parent;
	}
	return false;
}
