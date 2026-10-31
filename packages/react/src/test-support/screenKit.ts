import { Clock } from "effect";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { Screen } from "./Screen.ts";

export function screenKit<TState, TVerbs extends object>(
	name: string,
	create: () => TState,
	verbs: (state: TState, screen: Screen, now: () => number) => TVerbs,
) {
	return {
		clock: "live" as const,
		*create() {
			const clock = yield* Clock.Clock;
			const screen = new Screen(() => undefined);
			return { now: () => clock.currentTimeMillisUnsafe(), screen, state: create() };
		},
		inspect: ({ screen }: { screen: Screen; state: TState }) => screen.inspect(),
		name,
		stages: ["screen"] as const,
		verbs: ({ now, screen, state }: { now: () => number; screen: Screen; state: TState }, story: Story<{ screen: Screen; state: TState }>) => {
			screen.tell = story.tell;
			return verbs(state, screen, now);
		},
	};
}
