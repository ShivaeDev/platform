import { Effect, Stream } from "effect";
import { type ClientActivity, isClientIdle } from "@shivaedev/contract/clientActivity.ts";

export function waitForClient(activity: ClientActivity) {
	return activity.pipe(Stream.filter(isClientIdle), Stream.take(1), Stream.runDrain);
}

export const nextClientHint = Effect.fnUntraced(function* (activity: ClientActivity) {
	const before = (yield* activity.current).liveHints;
	return yield* activity.pipe(
		Stream.filter((state) => state.liveHints > before),
		Stream.take(1),
		Stream.runDrain,
	);
});
