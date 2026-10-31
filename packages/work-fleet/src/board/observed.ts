import { Effect, PubSub, Stream } from "effect";
import { BoardIndex } from "#board/Index.ts";
import type { BoardSnapshot } from "#board/readPass.ts";

export const observedBoard = Effect.fnUntraced(function* (current: BoardSnapshot, workId: string) {
	if (current.model.ids.has(workId)) {
		return current;
	}
	const indexed = yield* Effect.serviceOption(BoardIndex);
	if (indexed._tag === "None") {
		return current;
	}
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const { index, snapshot } = indexed.value;
			const events = yield* PubSub.subscribe(index.changes.events);
			const latest = yield* snapshot;
			if (latest.model.ids.has(workId)) {
				return latest;
			}
			yield* Stream.fromSubscription(events).pipe(
				Stream.mapEffect(() => snapshot),
				Stream.filter((state) => state.model.ids.has(workId)),
				Stream.take(1),
				Stream.runDrain,
				Effect.timeoutOption("500 millis"),
			);
			return yield* snapshot;
		}),
	);
});
