import { Clock, Effect } from "effect";
import { vi } from "vitest";
import { render } from "@shivaedev/effect-react/client/testing.ts";
import { RowTime, Time, TimeTicker } from "#client/react/Time.tsx";
import { trackScreen } from "./screenEngine.ts";
import { screenStory } from "./screenStory.ts";

function tickingTime(row: boolean) {
	return (at: number) => (
		<TimeTicker>
			<p className="time-host">{row ? <RowTime at={at} /> : <Time at={at} />}</p>
		</TimeTicker>
	);
}

export const TIME_NOW = new Date(2026, 9, 19, 12, 0);

export function timeScreen(millisecondsAgo = 0, place: "content" | "row" = "content") {
	const view = tickingTime(place === "row");
	return screenStory.trait(
		"screen",
		`a ${place} time ${millisecondsAgo} milliseconds before ${TIME_NOW.toString()} ticks from then`,
		function* (engine) {
			vi.useFakeTimers();
			vi.setSystemTime(TIME_NOW);
			const at = (yield* Clock.currentTimeMillis) - millisecondsAgo;
			engine.time = { at, view };
			trackScreen(engine, yield* Effect.promise(() => render(view(at))), (line) => engine.tell?.(line));
		},
	);
}
