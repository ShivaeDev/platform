import { fork } from "node:child_process";
import { once } from "node:events";
import { chmodSync, constants, mkdirSync, renameSync, symlinkSync } from "node:fs";
import { type FileHandle, open } from "node:fs/promises";
import { Effect } from "effect";
import { folder } from "./board.ts";
import { boardStory, projectFiles, responsesEnabled } from "./boardStory.ts";
import { heldRegisteredRead } from "./heldRegisteredRead.ts";
import { projectPath, publicationSetup } from "./publicationFaults.ts";
import { type BoardEngine, wrapFilesystem } from "./storyEngine.ts";

export const DIRECTION_TASK =
	"---\nid: task.choice\nkind: task\nattention:\n  - id: direction\n    kind: decision\n    state: open\n    response_from: [maintainer]\n    unblocks: [task.choice]\n    reason: Choose a direction\n---\n# Direction\n";

export function aTaskAwaitingDirection(responses = true) {
	return boardStory.traits(
		projectFiles({ "task.md": DIRECTION_TASK }, "task.choice asks the maintainer for direction"),
		...(responses ? [responsesEnabled()] : []),
	);
}

export function* outsideFolder(engine: BoardEngine, files: Readonly<Record<string, string>> = {}) {
	const setup = publicationSetup(engine);
	if (!setup.outside) {
		const outside = folder(files);
		setup.outside = outside;
		yield* Effect.addFinalizer(() => Effect.sync(outside.remove));
	}
	return setup.outside;
}

function* openedFolder(engine: BoardEngine) {
	const setup = publicationSetup(engine);
	if (!setup.folder) {
		mkdirSync(projectPath(engine, "responses"), { recursive: true });
		const handle = yield* Effect.promise(() =>
			open(projectPath(engine, "responses"), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW),
		);
		setup.folder = handle;
		yield* Effect.addFinalizer(() => Effect.promise(() => handle.close().catch(() => undefined)));
	}
	return setup.folder;
}

function* swapForOutside(engine: BoardEngine) {
	const outside = yield* outsideFolder(engine);
	return () => {
		renameSync(projectPath(engine, "responses"), projectPath(engine, "retained"));
		symlinkSync(outside.root, projectPath(engine, "responses"));
	};
}

function onSync(handle: FileHandle, after: (synced: () => Promise<void>) => Promise<void>) {
	const sync = handle.sync.bind(handle);
	handle.sync = () => after(sync);
}

export function responsesFolderOpen() {
	return boardStory.trait("project", "a writer has opened responses/ to publish into it", function* (engine) {
		yield* openedFolder(engine);
	});
}

export function folderSyncRefused() {
	return boardStory.trait("project", "the disk refuses the writer's first sync of responses/", function* (engine) {
		let refused = false;
		onSync(yield* openedFolder(engine), (sync) => {
			if (refused) {
				return sync();
			}
			refused = true;
			return Promise.reject(new Error("disk synchronization failed"));
		});
	});
}

export function folderSwappedAfterSync() {
	return boardStory.trait(
		"project",
		"right after the writer syncs responses/, an outside process moves it to retained/ and links responses/ to another folder",
		function* (engine) {
			const swap = yield* swapForOutside(engine);
			onSync(yield* openedFolder(engine), async (sync) => {
				await sync();
				swap();
			});
		},
	);
}

export function folderSwappedAtFinalCheck() {
	return boardStory.trait(
		"project",
		"during the writer's final boundary check, an outside process moves responses/ to retained/ and links responses/ to another folder",
		function* (engine) {
			const swap = yield* swapForOutside(engine);
			const handle = yield* openedFolder(engine);
			let checksAfterSync: number | undefined;
			onSync(handle, async (sync) => {
				await sync();
				checksAfterSync = 0;
			});
			const stat = handle.stat.bind(handle);
			// After the directory sync the writer checks its boundary once more, then once in cleanup; the swap lands before that last check.
			Object.defineProperty(handle, "stat", {
				value: () => {
					if (checksAfterSync !== undefined) {
						checksAfterSync += 1;
						if (checksAfterSync === 2) {
							swap();
						}
					}
					return stat();
				},
			});
		},
	);
}

export function readOnlyResponsesFolder() {
	return boardStory.trait("project", "responses/ exists but cannot be written", function* (engine) {
		const path = projectPath(engine, "responses");
		mkdirSync(path, { recursive: true });
		chmodSync(path, 0o500);
		yield* Effect.addFinalizer(() => Effect.sync(() => chmodSync(path, 0o700)));
	});
}

export function responseLinkedOutside(name: string) {
	return boardStory.trait("project", `responses/${name} is a link to reference.md in another folder`, function* (engine) {
		const outside = yield* outsideFolder(engine, { "reference.md": "Outside source" });
		mkdirSync(projectPath(engine, "responses"), { recursive: true });
		symlinkSync(`${outside.root}/reference.md`, projectPath(engine, `responses/${name}`));
	});
}

export function writerKilledAt(phase: "temporary" | "published") {
	return boardStory.trait(
		"project",
		`a writer publishing response.interrupted is killed right after it syncs its ${phase === "temporary" ? "temporary file" : "published record"}`,
		function* (engine) {
			const child = fork(new URL("./publicationChild.ts", import.meta.url), [engine.notes.root, phase], {
				execArgv: ["--conditions=source"],
				stdio: ["ignore", "pipe", "pipe", "ipc"],
			});
			const exited = once(child, "exit");
			let diagnostics = "";
			child.stderr?.on("data", (chunk) => {
				diagnostics += String(chunk);
			});
			const reached = yield* Effect.promise(() =>
				Promise.race([once(child, "message").then(([message]) => message), exited.then(() => diagnostics)]),
			);
			child.kill("SIGKILL");
			yield* Effect.promise(() => exited);
			if (reached !== phase) {
				return yield* Effect.die(new Error(`The writer stopped before its ${phase} sync: ${String(reached)}`));
			}
		},
	);
}

export function answerSavesWaitAtSourceRead() {
	return boardStory.trait("project", "an answer save waits while it re-reads task.md after registering its question", (engine) => {
		const held = heldRegisteredRead("task.md");
		publicationSetup(engine).heldSave = held;
		wrapFilesystem(engine, held.wrap);
	});
}
