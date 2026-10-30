import { Deferred, Effect, FileSystem, Layer, Path } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import { BoardGateway } from "#policy.ts";
import { boardReads } from "#test/boardReads.ts";

export const bufferedBoard = Effect.fn("FleetTest.bufferedBoard")(function* () {
	const source = yield* boardReads(256);
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const names = yield* fs.readDirectory(source.root);
	const files = names.map((name) => path.join(source.root, name));
	const criteria = JSON.stringify(
		Array.from({ length: 32 }, (_, index) => ({ id: `criterion${index}`, text: `Keep behavior ${index} observable.` })),
	);
	const contents = new Map(
		yield* Effect.forEach(files, (file) =>
			Effect.gen(function* () {
				const text = (yield* fs.readFileString(file)).replace("kind: task\n", `kind: task\ncriteria: ${criteria}\n`);
				yield* fs.writeFileString(file, text);
				return [file, text] as const;
			}),
		),
	);
	const info = new Map(yield* Effect.forEach([source.root, ...files], (file) => Effect.map(fs.stat(file), (value) => [file, value] as const)));
	let observed = Effect.void;
	let reading = false;
	const buffered: FileSystem.FileSystem = {
		...fs,
		readDirectory: (directory) => (directory === source.root ? Effect.succeed(names) : fs.readDirectory(directory)),
		readFileString: (file, options) => {
			const content = contents.get(file);
			return (content === undefined ? fs.readFileString(file, options) : Effect.succeed(content)).pipe(Effect.tap(() => observed));
		},
		realPath: (file) => (info.has(file) ? Effect.succeed(file) : fs.realPath(file)),
		stat: (file) => {
			const found = info.get(file);
			return found === undefined ? fs.stat(file) : Effect.succeed(found);
		},
	};
	const services = Layer.merge(Layer.succeed(FileSystem.FileSystem, buffered), Layer.succeed(Path.Path, path));
	const finishReading = Effect.sync(() => {
		reading = false;
	});
	const board = Layer.effect(BoardGateway)(
		Effect.map(BoardGateway, (original) =>
			BoardGateway.of({
				...original,
				get: (workId, options) => original.get(workId, options).pipe(Effect.ensuring(finishReading)),
			}),
		),
	).pipe(Layer.provide(markdownBoard(source.root).pipe(Layer.provide(services))));
	return {
		board,
		observeReads: Effect.gen(function* () {
			const entered = yield* Deferred.make<void>();
			reading = true;
			observed = Deferred.succeed(entered, undefined).pipe(Effect.asVoid);
			return Deferred.await(entered);
		}),
		readingBriefs: () => reading,
		root: source.root,
	};
});
