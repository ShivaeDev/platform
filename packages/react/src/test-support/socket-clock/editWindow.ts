import { Clock, Effect, Stream } from "effect";
import { EditExpired, Notes } from "#test/socket-clock/feature.ts";

export const editWindow = Effect.gen(function* () {
	const expiresAt = (yield* Clock.currentTimeMillis) + 30_000;
	return Notes.toLayer({
		"socketClockNotes.$changes": () => Stream.never,
		"socketClockNotes.save": () =>
			Effect.gen(function* () {
				return (yield* Clock.currentTimeMillis) >= expiresAt
					? yield* Effect.fail(new EditExpired({ message: "The edit window has closed" }))
					: "Saved";
			}),
	});
});
