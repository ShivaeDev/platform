import { Clock, Effect } from "effect";
import { vi } from "vitest";
import { render } from "@shivaedev/effect-react/client/testing.ts";
import { Time, TimeTicker } from "#client/react/Time.tsx";
import { trackScreen } from "./screenEngine.ts";
import { screenStory } from "./screenStory.ts";

function tickingTime(at: number) {
	return (
		<TimeTicker>
			<Time at={at} />
		</TimeTicker>
	);
}

export const TIME_NOW = new Date(2026, 9, 19, 12, 0);

export function timeScreen(millisecondsAgo = 0) {
	return screenStory.trait("screen", `a time ${millisecondsAgo} milliseconds before ${TIME_NOW.toString()} ticks from then`, function* (engine) {
		vi.useFakeTimers();
		vi.setSystemTime(TIME_NOW);
		const at = (yield* Clock.currentTimeMillis) - millisecondsAgo;
		engine.time = { at, view: tickingTime };
		trackScreen(engine, yield* Effect.promise(() => render(tickingTime(at))), (line) => engine.tell?.(line));
	});
}
