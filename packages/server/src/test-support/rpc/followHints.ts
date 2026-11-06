import { Effect, Fiber, Predicate, Queue, Stream } from "effect";
import type { QueryUpdate } from "@shivaedev/contract/queryUpdate.ts";
import { answered, words } from "@shivaedev/test-story/server/answers.ts";

function keyWords(key: unknown) {
	if (Predicate.hasProperty(key, "_tag") && key._tag === "List") {
		return "the list";
	}
	return Predicate.hasProperty(key, "id") ? String(key.id) : JSON.stringify(key);
}

export function hintWords(hint: QueryUpdate) {
	const name = words(hint._tag);
	return "keys" in hint ? `${name} ${hint.keys.map(keyWords).join(" and ")}` : name;
}

export const followHints = Effect.fnUntraced(function* <E, R>(stream: Stream.Stream<QueryUpdate, E, R>, initialResults = 1) {
	const hints: string[] = [];
	const queue = yield* Queue.unbounded<string>();
	const fiber = yield* stream.pipe(
		Stream.runForEach((hint) =>
			Effect.sync(() => {
				hints.push(hintWords(hint));
			}).pipe(Effect.andThen(Queue.offer(queue, hintWords(hint)))),
		),
		answered,
		Effect.forkScoped,
	);
	for (let index = 0; index < initialResults; index += 1) {
		const first = yield* Queue.take(queue);
		if (first !== "resync" && first !== "result") {
			return yield* Effect.die(`The subscription opened with ${first} instead of a result or resync`);
		}
	}
	return { ending: Fiber.join(fiber), hints, next: Queue.take(queue) };
});
export type Feed = Effect.Success<ReturnType<typeof followHints>>;
