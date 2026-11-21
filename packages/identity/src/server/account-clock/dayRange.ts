import { DateTime, Effect, Schema } from "effect";
import { boundary } from "#server/account-clock/boundary.ts";
import { LogicalDay } from "#server/account-clock/settings.ts";
import { zone } from "#server/account-clock/zone.ts";

const decodeDay = Schema.decodeUnknownEffect(LogicalDay.pipe(Schema.decodeTo(Schema.DateTimeUtcFromString)));

export function dayRange(minutes: number) {
	return Effect.fn("AccountClock.dayRange")(function* (account: string, day: string) {
		const next = DateTime.formatIsoDateUtc(DateTime.add(yield* decodeDay(day), { days: 1 }));
		const timeZone = yield* zone(account);
		return { end: yield* boundary(next, timeZone, minutes), start: yield* boundary(day, timeZone, minutes) };
	});
}
