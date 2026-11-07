import { DateTime, Effect, Schema } from "effect";
import { boundary } from "#server/account-clock/boundary.ts";
import type { initialize } from "#server/account-clock/initialize.ts";
import { LogicalDay } from "#server/account-clock/settings.ts";

export function dayRange({ minutes, timezone }: Effect.Success<typeof initialize>) {
	const decodeDay = Schema.decodeUnknownEffect(LogicalDay);
	return Effect.fn("AccountClock.dayRange")(function* (day: string) {
		yield* decodeDay(day);
		const next = DateTime.makeUnsafe(day).pipe(DateTime.add({ days: 1 }), DateTime.formatIsoDateUtc);
		return { end: yield* boundary(next, timezone, minutes), start: yield* boundary(day, timezone, minutes) };
	});
}
