import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Logger, PlatformError, Queue, Stream } from "effect";
import { isWatchSentinel } from "#server/files/watchSentinel.ts";
import { type FileSystemWrapper, folder } from "./board.ts";
import { fileReadingStory } from "./fileReadingStory.ts";

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

export function failedSentinelWrite(code: string): FileSystemWrapper {
	return (fs) => ({
		...fs,
		writeFileString: (path, data, options) =>
			isWatchSentinel(path)
				? Effect.fail(
						PlatformError.systemError({
							_tag: code === "EACCES" || code === "EPERM" ? "PermissionDenied" : "Unknown",
							cause: Object.assign(new Error(code), { code }),
							description: code,
							method: "writeFileString",
							module: "FileSystem",
							pathOrDescriptor: path,
						}),
					)
				: fs.writeFileString(path, data, options),
	});
}

export function sentinelWriteFails(code: string) {
	const warnings: unknown[] = [];
	return {
		trait: fileReadingStory.trait("project", `the host cannot write the workspace watch sentinel: ${code}`, (engine) => {
			warnings.length = 0;
			const logger = Logger.make(({ logLevel, message }) => {
				if (logLevel === "Warn") {
					warnings.push(message);
				}
			});
			engine.services = Layer.effect(FileSystem.FileSystem, Effect.map(FileSystem.FileSystem, failedSentinelWrite(code))).pipe(
				Layer.provideMerge(engine.services),
				Layer.provideMerge(Logger.layer([logger])),
			);
		}),
		warnings: () => [...warnings],
	};
}

export function aLinkedFolder() {
	let link: () => void;
	return {
		link: () => Effect.sync(() => link()),
		trait: fileReadingStory.trait("project", "a separate folder can be linked into the workspace", function* (engine) {
			const notes = yield* Effect.acquireRelease(
				Effect.sync(() => folder({ "linked.md": "# Linked" })),
				(acquired) => Effect.sync(acquired.remove),
			);
			link = () => symlinkSync(notes.root, join(engine.notes.root, "linked"), "dir");
		}),
	};
}
