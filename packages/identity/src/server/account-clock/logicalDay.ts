import { DateTime, Effect } from "effect";
import { boundary } from "./boundary.ts";
import type { initialize } from "./initialize.ts";

export function logicalDay({ minutes, timezone }: Effect.Success<typeof initialize>) {
	return Effect.fn("AccountClock.logicalDay")(function* (instant?: DateTime.Utc) {
		const now = instant ?? (yield* DateTime.now);
		const local = DateTime.setZoneNamedUnsafe(now, timezone);
		const day = DateTime.formatIsoDate(local);
		return DateTime.isLessThan(now, yield* boundary(day, timezone, minutes))
			? DateTime.makeUnsafe(day).pipe(DateTime.subtract({ days: 1 }), DateTime.formatIsoDateUtc)
			: day;
	});
}
