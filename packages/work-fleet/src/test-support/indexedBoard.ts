import { Effect, Option, PubSub, Stream } from "effect";
import type { Snapshot } from "@shivaedev/work-board/server/integration/board.ts";
import type { BoardIndex } from "#board/Index.ts";

export function indexedBoard(index: typeof BoardIndex.Service.index, ready: (snapshot: Snapshot) => boolean) {
	return Effect.scoped(
		Effect.gen(function* () {
			const events = yield* PubSub.subscribe(index.changes.events);
			return yield* Stream.fromEffect(index.read).pipe(
				Stream.concat(Stream.fromSubscription(events).pipe(Stream.mapEffect(() => index.read))),
				Stream.filter(ready),
				Stream.runHead,
				Effect.map(Option.getOrThrow),
			);
		}),
	);
}
