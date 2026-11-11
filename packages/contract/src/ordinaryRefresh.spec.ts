import { expect } from "vitest";
import { commands, connected, showingValue } from "#test/commands/story.ts";

commands.it(
	"a live: false query without reads refreshes after its contract's command that declares no keys",
	[connected(), showingValue()],
	function* ({ add, answer, shownValue }) {
		expect(yield* shownValue()).toBe("counter: 0");

		yield* add(2);
		expect(yield* answer()).toBe("counter: 2");

		expect(yield* shownValue()).toBe("counter: 2");
	},
);
