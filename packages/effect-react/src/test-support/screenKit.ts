import type { Story } from "@shivaedev/test-story/storyKit.ts";
import { Screen } from "./Screen.ts";

export function screenKit<TState, TVerbs extends object>(name: string, create: () => TState, verbs: (state: TState, screen: Screen) => TVerbs) {
	return {
		clock: "live" as const,
		create: () => {
			const screen = new Screen(() => undefined);
			return { screen, state: create() };
		},
		inspect: ({ screen }: { screen: Screen; state: TState }) => screen.inspect(),
		name,
		stages: ["screen"] as const,
		verbs: ({ screen, state }: { screen: Screen; state: TState }, story: Story<{ screen: Screen; state: TState }>) => {
			screen.tell = story.tell;
			return {
				observe: (line: string, check: () => void) => screen.observe(line, check),
				...verbs(state, screen),
			};
		},
	};
}
