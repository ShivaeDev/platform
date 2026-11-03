import { Clock, Effect } from "effect";
import { createContext, useContext } from "react";

export const clockReading = Effect.map(Clock.Clock, (clock) => ({ clock, now: () => clock.currentTimeMillisUnsafe() }));

export function currentTime() {
	return Effect.runSync(Clock.currentTimeMillis);
}
export const NowContext = createContext(currentTime());
export function useNow() {
	return useContext(NowContext);
}
