import { DateTime, Effect } from "effect";
import { boundary } from "#server/account-clock/boundary.ts";
import type { initialize } from "#server/account-clock/initialize.ts";

export function logicalDay({ minutes, timezone, zone }: Effect.Success<typeof initialize>) {
	return Effect.fn("AccountClock.logicalDay")(function* (instant?: DateTime.Utc) {
		const now = instant ?? (yield* DateTime.now);
		const local = DateTime.setZone(now, zone);
		const day = DateTime.formatIsoDate(local);
		return DateTime.isLessThan(now, yield* boundary(day, timezone, minutes)) ? DateTime.formatIsoDate(DateTime.subtract(local, { days: 1 })) : day;
	});
}
