import { Effect, Fiber, Predicate, Queue, Stream } from "effect";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { answered, words } from "#test/answers.ts";

function keyWords(key: unknown) {
	if (Predicate.hasProperty(key, "_tag") && key._tag === "List") {
		return "the list";
	}
	return Predicate.hasProperty(key, "id") ? String(key.id) : JSON.stringify(key);
}

export function hintWords(hint: LiveHint) {
	const name = words(hint._tag);
	return "keys" in hint ? `${name} ${hint.keys.map(keyWords).join(" and ")}` : name;
}

export const followHints = Effect.fnUntraced(function* <E, R>(stream: Stream.Stream<LiveHint, E, R>) {
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
	const first = yield* Queue.take(queue);
	if (first !== "resync") {
		return yield* Effect.die(`The subscription opened with ${first} instead of a resync`);
	}
	return { ending: Fiber.join(fiber), hints, next: Queue.take(queue) };
});
export type Feed = Effect.Success<ReturnType<typeof followHints>>;
