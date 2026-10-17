import { Effect, Ref, Stream } from "effect";
import type { Key } from "#keys.ts";
import type { LiveHint } from "#live.ts";
import type { makeLiveServer } from "#makeLiveServer.ts";

export function hintStream(hints: Effect.Success<typeof makeLiveServer>, keys: readonly Key[], active: Ref.Ref<number>, initial: LiveHint) {
	return Stream.unwrap(
		Effect.gen(function* () {
			let started = 0;
			let ready = false;
			yield* Effect.addFinalizer(() => (ready ? Ref.update(active, (count) => count - 1) : Effect.void));
			const streams = keys.map((key) => {
				let first = true;
				return hints.stream([key]).pipe(
					Stream.tap(() => {
						if (!first) {
							return Effect.void;
						}
						first = false;
						started += 1;
						if (started !== keys.length) {
							return Effect.void;
						}
						ready = true;
						return Ref.update(active, (count) => count + 1);
					}),
					Stream.drop(1),
				);
			});
			return Stream.concat(Stream.succeed(initial), Stream.mergeAll(streams, { concurrency: "unbounded" }));
		}),
	);
}
