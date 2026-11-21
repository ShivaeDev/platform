import { Effect, Option, Stream } from "effect";
import type { QueryUpdate } from "@shivaedev/contract/queryUpdate.ts";

export function firstChange<E, R>(changes: Stream.Stream<QueryUpdate, E, R>) {
	return changes.pipe(
		Stream.runHead,
		Effect.map(
			Option.match({
				onNone: () => "ended without a result",
				onSome: (update: QueryUpdate) => (update._tag === "Result" ? update.value : `unexpected ${update._tag}`),
			}),
		),
	);
}
