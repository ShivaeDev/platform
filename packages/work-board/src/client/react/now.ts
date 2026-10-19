import { Clock, Effect } from "effect";
import { createContext, useContext } from "react";

export function currentTime() {
	return Effect.runSync(Clock.currentTimeMillis);
}
export const NowContext = createContext(currentTime());
export function useNow() {
	return useContext(NowContext);
}
