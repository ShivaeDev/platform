import { Effect, Schedule } from "effect";

export function eventually(check: () => void) {
	return Effect.try(check).pipe(Effect.retry({ schedule: Schedule.spaced("10 millis"), times: 500 }));
}
