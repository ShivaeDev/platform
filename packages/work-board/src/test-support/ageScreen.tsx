import { Clock, Effect } from "effect";
import { vi } from "vitest";
import { render } from "@shivaedev/effect-react/client/testing.ts";
import { Age } from "#client/react/Age.tsx";
import { AgeTicker } from "#client/react/AgeLabel.tsx";
import { trackScreen } from "./screenEngine.ts";
import { screenStory } from "./screenStory.ts";

function tickingAge(modified: number) {
	return (
		<AgeTicker>
			<Age modified={modified} short />
		</AgeTicker>
	);
}

export function ageScreen() {
	return screenStory.trait("screen", "an age ticks from the current timestamp", function* (engine) {
		vi.useFakeTimers();
		const modified = yield* Clock.currentTimeMillis;
		engine.age = { modified, view: tickingAge };
		trackScreen(engine, yield* Effect.promise(() => render(tickingAge(modified))), (line) => engine.tell?.(line));
	});
}
