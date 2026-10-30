import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { readingReadyScreen } from "#test/readingReadyScreen.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();
screenStory.it(
	"waits beyond the initial frame and restores only when the document's readiness reaches navigation",
	[readingReadyScreen()],
	function* ({ click, findElement, readFocus, frame, location }) {
		yield* eventually(() => expect(findElement('.document-outline a[href="#heading-evidence"]')).not.toBeNull());
		yield* Effect.promise(() => frame(2));
		expect(readFocus()?.id).not.toBe("heading-evidence");
		expect(location()?.pathname).toBe("/nested/reading.md");
		expect(location()?.hash).toBe("heading-evidence");
		click(findElement<HTMLButtonElement>("[data-release-reading]"));
		yield* eventually(() => expect(readFocus()?.id).toBe("heading-evidence"));
	},
);
