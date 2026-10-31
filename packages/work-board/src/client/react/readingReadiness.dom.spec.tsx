import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { readinessHeld } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

screenStory.it(
	"a deep link focuses its heading only once the document reports it is ready for navigation",
	[readinessHeld()],
	function* ({ readerFocus, releaseReadiness }) {
		expect(yield* readerFocus()).toBe("nothing");

		yield* releaseReadiness();

		expect(yield* readerFocus()).toBe("heading Evidence Link to Evidence");
	},
);
