import { Clock, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { vi } from "vitest";
import { render } from "@shivaedev/test-story/client/react.ts";
import { RowTime, Time, TimeAsOf, TimeTicker } from "#client/react/Time.tsx";
import { renderBoard } from "./react.tsx";
import { trackScreen } from "./screenEngine.ts";
import { screenStory } from "./screenStory.ts";

function fixedTime(row: boolean) {
	return (at: number) => (
		<TimeAsOf now={TIME_NOW.getTime()}>
			<p className="time-host">{row ? <RowTime at={at} /> : <Time at={at} />}</p>
		</TimeAsOf>
	);
}

export const TIME_NOW = new Date(2026, 9, 19, 12, 0);

export function timeScreen(millisecondsAgo = 0, place: "content" | "row" = "content") {
	const view = fixedTime(place === "row");
	return screenStory.trait(
		"screen",
		`a ${place} time ${millisecondsAgo} milliseconds before ${TIME_NOW.toString()} is shown as of then`,
		function* (engine) {
			vi.useFakeTimers();
			const at = TIME_NOW.getTime() - millisecondsAgo;
			engine.time = { at, view };
			trackScreen(engine, yield* Effect.promise(() => render(view(at))), (line) => engine.tell?.(line));
		},
	);
}

export function tickingTimeScreen() {
	return screenStory.trait("screen", "a mounted time follows the runtime clock", function* (engine) {
		const clock = yield* Clock.Clock;
		const runtime = Atom.context();
		runtime.addGlobalLayer(Layer.succeed(Clock.Clock, clock));
		const at = yield* Clock.currentTimeMillis;
		function view(timestamp: number) {
			return (
				<TimeTicker>
					<Time at={timestamp} />
				</TimeTicker>
			);
		}
		engine.time = { at, view };
		const rendered = yield* Effect.promise(() => renderBoard({}, () => null, undefined, runtime));
		trackScreen(engine, rendered, (line) => engine.tell?.(line));
		yield* AtomRegistry.getResult(rendered.registry, rendered.forms.runtime.atom(Clock.Clock));
		yield* Effect.promise(() => rendered.render(view(at)));
	});
}
