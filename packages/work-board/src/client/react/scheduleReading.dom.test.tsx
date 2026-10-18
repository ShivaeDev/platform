import { shellIds } from "#client/react/shellIds.ts";

const PASSAGE = "heading-evidence";

import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { observedBrowserMotion } from "#test/browserMotion.ts";
import { screenStory } from "#test/screenStory.ts";
import { componentScreen, routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
screenStory.it(
	"restores a saved passage once on the queued frame without scrolling or focusing the heading",
	[
		observedBrowserMotion(),
		componentScreen(
			<article id={shellIds.doc}>
				<h2 id={PASSAGE} tabIndex={-1}>
					Evidence
				</h2>
			</article>,
		),
	],
	function* ({ queueReading, readScrollAnchoring, readMotion, readReadingStatus, frame }) {
		const anchoring = readScrollAnchoring();
		queueReading({ scroll: [0, 480], selection: null }, "heading-evidence");
		yield* Effect.promise(() => frame());
		expect(readScrollAnchoring()).toBe("none");
		yield* Effect.promise(() => frame(2));
		expect(readMotion("scroll")).toEqual([[0, 480]]);
		expect(readReadingStatus()).toEqual([""]);
		expect(readMotion("passage")).toHaveLength(0);
		expect(readMotion("focus")).toHaveLength(0);
		expect(readScrollAnchoring()).toBe(anchoring);
	},
);

for (const navigation of ["Back", "reload"]) {
	const files = {
		"home.md": "# Home",
		"notes/plan.md": "# Plan\n\n## Evidence\n\nRead this passage.\n\n<details><summary>More</summary>Saved reading details.</details>",
		"other.md": "# Other",
	};
	const URL = "/notes/plan.md#heading-evidence";
	screenStory.it(
		`reports a missing saved passage after ${navigation} while retaining reading position`,
		[observedBrowserMotion(), routedScreen(files, URL)],
		function* ({
			editFile,
			refreshDocument,
			readText,
			readFocus,
			readMotion,
			setScrollPosition,
			clearMotion,
			openDetails,
			navigate,
			frame,
			browserEvent,
			location,
			rememberHistory,
			closeScreen,
			renderRouter,
			back,
			findElement,
		}) {
			yield* Effect.promise(() => eventually(() => expect(readFocus()?.id).toBe("heading-evidence")));
			editFile("notes/plan.md", "# Plan\n\nThe heading disappeared.\n\n<details><summary>More</summary>Saved reading details.</details>");
			yield* Effect.promise(() => refreshDocument("/notes/plan.md"));
			yield* Effect.promise(() => eventually(() => expect(readText("#doc")).toContain("The heading disappeared.")));
			openDetails("article details:not(.item-context)");
			setScrollPosition(480);
			if (navigation === "Back") {
				yield* Effect.promise(() => navigate("/other.md"));
				yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Other")));
				yield* Effect.promise(() => frame());
			} else {
				browserEvent("pagehide");
				const state = location()?.state;
				yield* Effect.promise(closeScreen);
				rememberHistory({ workBoard: { id: state?.key } });
			}
			setScrollPosition(0);
			clearMotion();
			const previousFocus = readFocus();
			if (navigation === "Back") {
				yield* Effect.promise(back);
			} else {
				yield* Effect.promise(() => renderRouter(undefined, URL));
			}
			yield* Effect.promise(() => eventually(() => expect(readText("#navigation-status")).toBe("This passage is no longer in the document.")));
			expect(location()?.hash).toBe("heading-evidence");
			expect(findElement("article details:not(.item-context)")).toHaveProperty("open", true);
			expect(readMotion("scroll")).toEqual([[0, 480]]);
			expect(readMotion("passage")).toHaveLength(0);
			expect(readMotion("focus")).toHaveLength(navigation === "Back" ? 1 : 0);
			expect(readFocus()).toBe(navigation === "Back" ? findElement("#doc") : previousFocus);
		},
	);
}
