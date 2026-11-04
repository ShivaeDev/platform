import { DateTime, Effect, Schema } from "effect";
import type { initialize } from "./initialize.ts";
import { LogicalDay } from "./settings.ts";

export function dayRange({ boundary }: Effect.Success<typeof initialize>) {
	const decodeDay = Schema.decodeUnknownEffect(LogicalDay);
	return Effect.fnUntraced(function* (day: string) {
		yield* decodeDay(day);
		const next = DateTime.makeUnsafe(day).pipe(DateTime.add({ days: 1 }), DateTime.formatIsoDateUtc);
		return { end: boundary(next), start: boundary(day) };
	});
}
