import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { markdownChunkFails } from "#test/markdownChunkFails.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { screenRoute, todayScreen } from "#test/screenWorkspaceTraits.ts";

screenStory.it(
	"says Markdown could not load and keeps the Board usable when the renderer chunk fails",
	[todayScreen(), screenRoute("/home.md"), markdownChunkFails(), openScreen()],
	function* ({ navigate, readText }) {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(readText("#doc [data-markdown-error]")).toMatch(/^Markdown could not be loaded: .+\. Reload the page to try again\.$/u),
			),
		);
		yield* Effect.promise(() => navigate("/_board/goals"));
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Goals")));
	},
);
