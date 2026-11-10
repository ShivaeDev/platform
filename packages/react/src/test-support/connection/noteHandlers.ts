import { Effect, Layer, Queue, Stream } from "effect";
import { QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import { Notes, Summary } from "#test/connection/feature.ts";

export const noteHandlers = Effect.gen(function* () {
	const closed = yield* Queue.unbounded<void>();
	const notes = { refused: false, title: "One" };
	function updates(value: () => string) {
		return Stream.suspend(() =>
			Stream.concat(
				Stream.succeed(
					notes.refused
						? new QueryReadDenied({ message: "Private note" })
						: { _tag: "Result" as const, query: "get" as const, queryIndex: 0, value: value() },
				),
				Stream.never,
			),
		).pipe(Stream.ensuring(Queue.offer(closed, undefined)));
	}
	const layer = Layer.merge(
		Notes.toLayer({
			"connectionNotes.$changes": () => updates(() => notes.title),
			"connectionNotes.get": () => Effect.succeed(notes.title),
		}),
		Summary.toLayer({
			"connectionSummary.$changes": () => updates(() => "Summary"),
			"connectionSummary.get": () => Effect.succeed("Summary"),
		}),
	);
	return { closed, layer, notes };
});
