import { Effect, Schema } from "effect";
import { AccountPreferencesStore } from "#server/account-preferences/service.ts";
import { Subject } from "#subject.ts";
import { AccountDayStart, DayStart } from "./settings.ts";

export const initialize = Effect.gen(function* () {
	const { id } = yield* Subject;
	const { timezone } = yield* (yield* AccountPreferencesStore).get(id);
	const minutes = yield* Schema.decodeUnknownEffect(DayStart)(yield* AccountDayStart);
	return { minutes, timezone };
});
