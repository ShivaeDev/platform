import { Context, Effect, FileSystem, Layer, Stream } from "effect";
import { isWatchSentinel } from "@shivaedev/work-board/server/files/watchSentinel.ts";
import { markdownBoard } from "#board/markdown.ts";
import { watchedBoard } from "#board/watched.ts";
import { BoardGateway } from "#policy.ts";
import { boardReadStory } from "#test/boardReadStory.ts";

export function watchedBoardReads() {
	return boardReadStory.trait("files", "the watched Board index has not observed subsequent file edits", function* (state) {
		const index = watchedBoard(state.fixture.root).pipe(
			Layer.updateService(FileSystem.FileSystem, (fs) => ({
				...fs,
				// Confirm watcher readiness while withholding subsequent Board edits.
				watch: (path, options) => fs.watch(path, options).pipe(Stream.filter((event) => isWatchSentinel(event.path))),
			})),
		);
		const context = yield* Layer.build(markdownBoard(state.fixture.root).pipe(Layer.provideMerge(index), Layer.provide(state.fixture.services)));
		const service = Context.get(context, BoardGateway);
		state.board = { ...service, get: (...args) => service.get(...args).pipe(Effect.provideContext(context)) };
	});
}
