import { DateTime, Effect, Schema } from "effect";
import { AccountPreferencesStore } from "#server/AccountPreferencesStore.ts";
import { Subject } from "#subject.ts";
import { AccountDayStart, DayStart } from "./settings.ts";

export const initialize = Effect.gen(function* () {
	const { id } = yield* Subject;
	const { timezone } = yield* (yield* AccountPreferencesStore).get(id);
	const minutes = yield* Schema.decodeUnknownEffect(DayStart)(yield* AccountDayStart);
	function boundary(day: string) {
		return DateTime.toUtc(
			DateTime.makeZonedUnsafe(`${day}T00:00:00.000Z`, {
				adjustForTimeZone: true,
				disambiguation: "compatible",
				timeZone: timezone,
			}).pipe(DateTime.setParts({ hour: Math.floor(minutes / 60), minute: minutes % 60 })),
		);
	}
	return { boundary, timezone };
});
