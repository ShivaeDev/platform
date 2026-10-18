import { Clock, Effect } from "effect";
import { vi } from "vitest";
import { render } from "@shivaedev/effect-react/testing.ts";
import { Age, AgeTicker } from "#client/react/Age.tsx";
import { trackScreen } from "./screenEngine.ts";
import { screenStory } from "./screenStory.ts";

export function ageScreen() {
	return screenStory.trait("screen", "an age ticks from the current timestamp", function* (engine) {
		vi.useFakeTimers();
		engine.ageModified = yield* Clock.currentTimeMillis;
		trackScreen(
			engine,
			yield* Effect.promise(() =>
				render(
					<AgeTicker>
						<Age modified={engine.ageModified ?? 0} short />
					</AgeTicker>,
				),
			),
			(line) => engine.tell?.(line),
		);
	});
}
