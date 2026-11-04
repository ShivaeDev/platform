import { DateTime, Effect } from "effect";
import type { initialize } from "./initialize.ts";

export function logicalDay({ boundary, timezone }: Effect.Success<typeof initialize>) {
	return Effect.fnUntraced(function* (instant?: DateTime.Utc) {
		const now = instant ?? (yield* DateTime.now);
		const local = DateTime.setZoneNamedUnsafe(now, timezone);
		const day = DateTime.formatIsoDate(local);
		return DateTime.isLessThan(now, boundary(day)) ? DateTime.makeUnsafe(day).pipe(DateTime.subtract({ days: 1 }), DateTime.formatIsoDateUtc) : day;
	});
}
