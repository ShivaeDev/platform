import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { archivedReadingReady, archivedScreen } from "#test/archivedScreen.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"renders the archived question and its recorded answer at the existing item URL",
	[archivedScreen(), openScreen(), archivedReadingReady],
	function* ({ readText, roles }) {
		yield* roles.find('[data-outcome-answer="answer.settled"]');

		expect(readText("#doc")).toContain("Keep the reviewed option.");
		expect(readText("#doc h1")).toContain("settled");
	},
);
