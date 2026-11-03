import { NodeServices } from "@effect/platform-node";
import { Clock, Deferred, Effect, FileSystem, Layer, Path, PlatformError } from "effect";
import { Workspace } from "@shivaedev/work-board/server/workspace.ts";
import { markdownBoard } from "#board/markdown.ts";
import { headlessBoard } from "#board/workspace.ts";
import { BoardGateway } from "#policy.ts";

export const boardReads = Effect.fn("BoardTest.boardReads")(function* (count: number) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "fleet-reads-" }));
	const unreadable = new Set<string>();
	let workspace: typeof Workspace.Service | undefined;
	let announce = true;
	function refresh(files: readonly string[]) {
		return workspace && announce
			? workspace.settings().pipe(Effect.flatMap(({ changes }) => changes.refreshPaths?.(files) ?? Effect.void))
			: Effect.void;
	}
	let afterRead = Effect.void;
	const tracked: FileSystem.FileSystem = {
		...fs,
		readDirectory: (folder) =>
			unreadable.has(path.relative(root, folder) || ".")
				? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readDirectory", module: "FileSystem" }))
				: fs.readDirectory(folder),
		readFile: (file) =>
			unreadable.has(path.relative(root, file))
				? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFile", module: "FileSystem" }))
				: fs.readFile(file),
		readFileString: (file, options) =>
			Effect.suspend(() =>
				unreadable.has(path.relative(root, file))
					? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
					: fs.readFileString(file, options),
			).pipe(Effect.tap(() => afterRead)),
	};
	function source(id: string, approved = true, body = "Useful work.") {
		return `---\nid: ${id}\nkind: task\nfleet: ${approved ? "approved" : "held"}\n---\n# ${id}\n\n${body}\n`;
	}
	function write(file: string, content: string) {
		return fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true }).pipe(
			Effect.andThen(fs.writeFileString(path.join(root, file), content)),
			Effect.andThen(() => refresh([file])),
		);
	}
	for (let index = 0; index < count; index += 1) {
		yield* write(`${index}.md`, source(`item.${index}`));
	}
	const services = Layer.mergeAll(Layer.succeed(FileSystem.FileSystem)(tracked), Layer.succeed(Path.Path)(path));
	return {
		announceEdits: (value: boolean) => {
			announce = value;
		},
		board: Layer.effect(BoardGateway)(
			Effect.gen(function* () {
				workspace = yield* Workspace;
				return yield* BoardGateway;
			}),
		).pipe(
			Layer.provideMerge(markdownBoard(root).pipe(Layer.provideMerge(headlessBoard(root)))),
			Layer.provide(services),
			Layer.provide(Layer.succeed(Clock.Clock, Clock.Clock.defaultValue())),
		),
		observeWith: (board: typeof Workspace.Service) =>
			Effect.sync(() => {
				workspace = board;
			}),
		pauseReads: Effect.gen(function* () {
			const entered = yield* Deferred.make<void>();
			const release = yield* Deferred.make<void>();
			afterRead = Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)));
			return { entered: Deferred.await(entered), release: Deferred.succeed(release, undefined) };
		}),
		refresh: () => (workspace ? workspace.settings().pipe(Effect.flatMap(({ changes }) => changes.refresh ?? Effect.void)) : Effect.void),
		remove: (file: string) => fs.remove(path.join(root, file), { recursive: true }).pipe(Effect.andThen(() => refresh([file]))),
		root,
		services,
		source,
		unreadable,
		write,
	};
}, Effect.provide(NodeServices.layer));
