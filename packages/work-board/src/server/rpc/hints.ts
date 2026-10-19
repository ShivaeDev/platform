import { Effect, Fiber, Option, Predicate, PubSub, Stream } from "effect";
import type { LiveHint } from "@shivaedev/effect-contract/live.ts";
import type { Indexing } from "#rpc/Indexing.ts";
import type { Change } from "#server/files/changes.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { Workspace } from "#server/workspace.ts";
import { affected } from "./affected.ts";

export function hints() {
	return Stream.unwrap(
		Effect.gen(function* () {
			const workspace = yield* Workspace;
			const { changes, indexing = Stream.empty } = yield* workspace.settings();
			const index = workspace.index();
			const subscription = yield* PubSub.subscribe(changes.events);
			let sequence = changes.sequence ? yield* changes.sequence : undefined;
			let previous = Option.none<Snapshot>();
			const indexed = yield* Effect.forkScoped(Effect.option(index));
			function nextHint(change: Change) {
				return Effect.gen(function* () {
					const current = yield* Effect.option(index);
					const contiguous = sequence !== undefined && change.sequence === sequence + 1;
					sequence = change.sequence;
					let hint: LiveHint = { _tag: "Resync" };
					if (contiguous && change._tag === "Changed" && previous._tag === "Some" && current._tag === "Some") {
						const keys = affected(previous.value, current.value, change.paths);
						if (keys !== undefined) {
							hint = { _tag: "Changed", keys };
						}
					}
					previous = current;
					return hint;
				});
			}

			const progress: Stream.Stream<Indexing | LiveHint> = indexing.pipe(
				Stream.filter(Predicate.isNotUndefined),
				Stream.interruptWhen(Fiber.await(indexed)),
			);
			const ready = Stream.fromEffect(
				Effect.map(Fiber.join(indexed), (snapshot): LiveHint => {
					previous = snapshot;
					return { _tag: "Resync" };
				}),
			);
			const changesStream = Stream.fromSubscription(subscription).pipe(
				Stream.mapEffect(nextHint),
				Stream.filter((hint) => hint._tag === "Resync" || hint.keys.length > 0),
			);
			return progress.pipe(Stream.concat(ready), Stream.concat(changesStream));
		}),
	);
}
