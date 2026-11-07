import { Effect, Schema } from "effect";
import { AccountDayStart, DayStart } from "#server/account-clock/settings.ts";
import { AccountPreferencesStore } from "#server/account-preferences/service.ts";
import { Subject } from "#subject.ts";

export const initialize = Effect.gen(function* () {
	const { id } = yield* Subject;
	const { timezone } = yield* (yield* AccountPreferencesStore).get(id);
	const minutes = yield* Schema.decodeUnknownEffect(DayStart)(yield* AccountDayStart);
	return { minutes, timezone };
});
