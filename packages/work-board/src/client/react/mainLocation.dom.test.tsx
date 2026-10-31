import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { screenStory } from "#test/screenStory.ts";
import { hostedHealthSettled } from "#test/shellTraits.tsx";

expectNoReactWarnings();

const SETTLED = "Connection: live; last observed source watcher: unavailable; reads settled";

screenStory.it(
	"reads live health from the host's displayed location when the host has no document element",
	[hostedHealthSettled()],
	function* ({ liveTooltip, pageAddress }) {
		yield* outcomes([
			["the document element's address", () => pageAddress(), undefined],
			["the live tooltip", () => liveTooltip(), SETTLED],
		]);
	},
);

screenStory.it(
	"retries the host's page without a document element and its reads stay settled",
	[hostedHealthSettled()],
	function* ({ hostRetries, liveTooltip }) {
		expect(yield* liveTooltip()).toBe(SETTLED);

		yield* hostRetries();

		expect(yield* liveTooltip()).toBe(SETTLED);
	},
);

screenStory.it(
	"clears Couldn't update this page once the host retries a document that recovered",
	[hostedHealthSettled()],
	function* ({ hostRetries, hostShowsUnreadableDocument, liveIndicator, liveTooltip, recoverDocument }) {
		yield* hostShowsUnreadableDocument();
		yield* recoverDocument();
		expect((yield* liveIndicator()).announced).toBe("Couldn't update this page");

		yield* hostRetries();

		yield* outcomes([
			["the live status", () => liveIndicator(), expect.objectContaining({ announced: "Reconnecting…" })],
			["the live tooltip", () => liveTooltip(), SETTLED],
		]);
	},
);
