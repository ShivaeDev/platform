import { NodeServices } from "@effect/platform-node";
import { Deferred, Effect, FileSystem, Layer, Path, PlatformError } from "effect";
import { markdownBoard } from "#board/markdown.ts";

export const boardReads = Effect.fn("BoardTest.boardReads")(function* (count: number) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = yield* fs.makeTempDirectoryScoped({ prefix: "fleet-reads-" });
	const reads = new Map<string, number>();
	const unreadable = new Set<string>();
	let scans = 0;
	let afterRead = Effect.void;
	const tracked: FileSystem.FileSystem = {
		...fs,
		readDirectory: (folder) =>
			Effect.sync(() => {
				scans += 1;
			}).pipe(
				Effect.andThen(() =>
					unreadable.has(".")
						? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readDirectory", module: "FileSystem" }))
						: fs.readDirectory(folder),
				),
			),
		readFileString: (file, options) =>
			Effect.sync(() => {
				reads.set(file, (reads.get(file) ?? 0) + 1);
			}).pipe(
				Effect.andThen(() =>
					unreadable.has(path.relative(root, file))
						? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
						: fs.readFileString(file, options),
				),
				Effect.tap(() => afterRead),
			),
	};
	function source(id: string, approved = true, body = "Useful work.") {
		return `---\nid: ${id}\nkind: task\nfleet: ${approved ? "approved" : "draft"}\n---\n# ${id}\n\n${body}\n`;
	}
	function write(file: string, content: string) {
		return fs.writeFileString(path.join(root, file), content);
	}
	for (let index = 0; index < count; index += 1) {
		yield* write(`${index}.md`, source(`item.${index}`));
	}
	const services = Layer.mergeAll(Layer.succeed(FileSystem.FileSystem)(tracked), Layer.succeed(Path.Path)(path));
	return {
		board: markdownBoard(root).pipe(Layer.provide(services)),
		pauseReads: Effect.gen(function* () {
			const entered = yield* Deferred.make<void>();
			const release = yield* Deferred.make<void>();
			afterRead = Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)));
			return { entered: Deferred.await(entered), release: Deferred.succeed(release, undefined) };
		}),
		reads,
		remove: (file: string) => fs.remove(path.join(root, file)),
		root,
		scans: () => scans,
		services,
		source,
		unreadable,
		write,
	};
}, Effect.provide(NodeServices.layer));
