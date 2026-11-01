import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import type { RpcMessage } from "effect/rpc";
import type { BrowserSubscription } from "#browserReads.ts";

export const browserSubscriptions = Effect.sync(() => {
	const openings: BrowserSubscription[] = [];
	let changed = Deferred.makeUnsafe<void>();
	function settle(index: number, state: BrowserSubscription) {
		openings[index] = state;
		const signal = changed;
		changed = Deferred.makeUnsafe<void>();
		return Deferred.succeed(signal, undefined);
	}
	const waitForSubscriptions: Effect.Effect<void> = Effect.suspend(() =>
		openings.every(({ state }) => state !== "open") ? Effect.void : Deferred.await(changed).pipe(Effect.andThen(waitForSubscriptions)),
	);
	return {
		open: (payload: unknown, tag: string) => {
			openings.push({ payload, state: "open", tag });
			return openings.length - 1;
		},
		receive: (index: number, message: RpcMessage.FromServerEncoded) => {
			const opening = openings[index];
			if (opening === undefined || opening.state !== "open") {
				return Effect.void;
			}
			if (message._tag === "Chunk" && message.values.length > 0) {
				return settle(index, { ...opening, state: "answered" });
			}
			if (message._tag !== "Exit" || message.exit._tag !== "Failure") {
				return Effect.void;
			}
			for (const cause of message.exit.cause) {
				if (cause._tag === "Fail" && Predicate.hasProperty(cause.error, "_tag") && typeof cause.error._tag === "string") {
					return settle(index, { ...opening, refusalTag: cause.error._tag, state: "refused" });
				}
			}
			return Effect.void;
		},
		subscriptions: () => openings.map((opening) => ({ ...opening })),
		waitForSubscriptions,
	};
});
