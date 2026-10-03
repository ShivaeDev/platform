import { Effect } from "effect";

export type PublishFailure = "log" | "die";

export type Publish<A, R = never> = (changes: readonly A[]) => Effect.Effect<void, unknown, R>;

export const publisher = <A, R>(
	name: string,
	policy: PublishFailure,
): ((sink: Publish<A, R>, changes: readonly A[]) => Effect.Effect<void, never, R>) =>
	Effect.fn("Changes.publish")(function* (sink: Publish<A, R>, changes: readonly A[]) {
		yield* Effect.annotateCurrentSpan({ "changes.channel": name, "changes.count": changes.length });
		const sent = Effect.suspend(() => sink(changes));
		if (policy === "die") {
			return yield* Effect.orDie(sent);
		}
		yield* Effect.catchCause(sent, (cause) =>
			Effect.andThen(
				Effect.annotateCurrentSpan("changes.published", false),
				Effect.logError("Changes.publish failed after the changes were committed; the committed result stands", cause),
			).pipe(Effect.annotateLogs({ changes: changes.length, channel: name })),
		);
	}, Effect.uninterruptible);
