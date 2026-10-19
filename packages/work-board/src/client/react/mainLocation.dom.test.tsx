import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { hostedHealthScreen } from "#test/hostedHealthScreen.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();
screenStory.it(
	"uses the host's displayed location for live health and retries without a document element",
	[hostedHealthScreen()],
	function* ({ click, findElement, readText, readAttribute, recoverDocument }) {
		expect(findElement("#doc")).toBeNull();
		yield* Effect.promise(() => eventually(() => expect(readAttribute("#live", "title")).toContain("reads settled")));
		click("[data-retry]");
		yield* Effect.promise(() => eventually(() => expect(readAttribute("#live", "title")).toContain("reads settled")));
		click("[data-document]");
		yield* Effect.promise(() => eventually(() => expect(readText("#live")).toBe("Couldn't update this page")));
		recoverDocument();
		click("[data-retry]");
		yield* Effect.promise(() => eventually(() => expect(readText("#live")).toBe("Reconnecting…")));
		expect(readAttribute("#live", "title")).toContain("reads settled");
	},
);
