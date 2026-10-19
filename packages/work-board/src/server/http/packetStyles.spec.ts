import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";

boardStory.it(
	"wraps the plain fenced text of a decision packet instead of scrolling it sideways",
	[projectFiles({ "plan.md": "# Plan\n" })],
	function* ({ exchange }) {
		const styles = (yield* exchange("/_board/react.css")).text;
		expect(styles).toMatch(/\[data-decision-packet\] \.reading-column pre:not\(\[class\]\)\s*\{\s*white-space:\s*pre-wrap;?\s*\}/u);
	},
);
