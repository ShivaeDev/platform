import { Clock, Effect } from "effect";

export const clockReading = Effect.gen(function* () {
	const clock = yield* Clock.Clock;
	return "adjust" in clock ? `the test clock at ${yield* Clock.currentTimeMillis} ms` : "the live clock";
});
