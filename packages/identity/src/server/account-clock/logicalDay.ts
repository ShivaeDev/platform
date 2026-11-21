import { DateTime, Effect } from "effect";
import { boundary } from "#server/account-clock/boundary.ts";
import { zone } from "#server/account-clock/zone.ts";

export function logicalDay(minutes: number) {
	return Effect.fn("AccountClock.logicalDay")(function* (account: string, instant?: DateTime.Utc) {
		const now = instant ?? (yield* DateTime.now);
		const timeZone = yield* zone(account);
		const local = DateTime.setZone(now, timeZone);
		const day = DateTime.formatIsoDate(local);
		return DateTime.isLessThan(now, yield* boundary(day, timeZone, minutes)) ? DateTime.formatIsoDate(DateTime.subtract(local, { days: 1 })) : day;
	});
}
