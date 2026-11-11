import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { commands, connected, showingValue } from "#test/commands/story.ts";

commands.it(
	"a live: false query without reads refreshes after its contract's command that declares no keys",
	[connected(), showingValue()],
	function* ({ add, answer, shownValue }) {
		expect(yield* shownValue()).toBe("counter: 0");

		yield* add(2);

		yield* outcomes([
			["command", () => answer(), "counter: 2"],
			["query", () => shownValue(), "counter: 2"],
		]);
	},
);
