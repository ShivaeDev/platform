import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { socketClockStory } from "#test/socket-clock/story.tsx";

socketClockStory.it(
	"a reconnect held across a minute of story time still shows the application's expired edit refusal",
	[],
	function* ({ dropSocket, minutePasses, reconnectDelayPasses, releaseHandshake, save, shown }) {
		yield* save();
		expect(yield* shown()).toBe("Saved");
		yield* dropSocket();
		yield* reconnectDelayPasses();

		yield* minutePasses();
		yield* releaseHandshake();
		yield* save();

		expect(yield* shown()).toBe("The edit window has closed");
	},
);

socketClockStory.it(
	"a minute of story time expires the edit window without reconnecting the socket",
	[],
	function* ({ handshakes, minutePasses, save, shown }) {
		yield* save();
		expect(yield* shown()).toBe("Saved");

		yield* minutePasses();
		yield* save();

		yield* outcomes([
			["shown refusal", () => shown(), "The edit window has closed"],
			["WebSocket handshakes", () => handshakes(), 1],
		]);
	},
);
