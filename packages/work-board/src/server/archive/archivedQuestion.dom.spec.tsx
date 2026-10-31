import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { archivedScreen } from "#test/archivedScreen.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

screenStory.it(
	"an archived question opens at its item URL with its recorded answer",
	[archivedScreen(), openScreen()],
	function* ({ itemTitle, outcomeAnswer }) {
		yield* outcomes({
			answer: [outcomeAnswer("answer.settled"), expect.stringContaining("Keep the reviewed option.")],
			title: [itemTitle(), expect.stringContaining("settled")],
		});
	},
);
