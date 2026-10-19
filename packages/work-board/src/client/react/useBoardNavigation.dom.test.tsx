import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { observedBrowserMotion } from "#test/browserMotion.ts";
import { fallibleDocument } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
screenStory.it(
	"clears a recovered current-document refresh failure without restoring reading position",
	[
		observedBrowserMotion(),
		fallibleDocument(),
		routedScreen({ "home.md": "# Home", "notes/plan.md": "# Plan\n\n## Evidence\n\nRead this passage.\n" }, "/notes/plan.md#heading-evidence", {
			home: "home.md",
		}),
	],
	function* ({
		readAttribute,
		readText,
		readFocus,
		findElement,
		location,
		focus,
		setScrollPosition,
		failDocument,
		recoverDocument,
		refreshDocument,
		frame,
		clearMotion,
		readMotion,
		readScrollPosition,
	}) {
		yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-status")).toBe("200")));
		yield* Effect.promise(() => eventually(() => expect(readFocus()?.id).toBe("heading-evidence")));
		const previousLocation = location();
		const doc = findElement("#doc");
		focus("#search-open");
		setScrollPosition(480);
		clearMotion();
		failDocument();
		yield* Effect.promise(() => refreshDocument("/notes/plan.md"));
		yield* Effect.promise(() => eventually(() => expect(readText("#navigation-status")).toBe("Couldn't refresh this page")));
		expect(readAttribute("#navigation-status", "data-state")).toBe("failed");
		expect(readAttribute("#doc", "data-status")).toBe("503");
		expect(readText("#doc")).toContain("Read this passage.");
		recoverDocument();
		yield* Effect.promise(() => refreshDocument("/notes/plan.md"));
		yield* Effect.promise(() => eventually(() => expect(readAttribute("#doc", "data-status")).toBe("200")));
		yield* Effect.promise(() => eventually(() => expect(readText("#navigation-status")).toBe("")));
		yield* Effect.promise(() => frame());
		expect(location()).toBe(previousLocation);
		expect(findElement("#doc")).toBe(doc);
		expect(readFocus()).toBe(findElement("#search-open"));
		expect(readScrollPosition()).toBe(480);
		expect(readMotion("scroll")).toHaveLength(0);
		expect(readMotion("passage")).toHaveLength(0);
	},
);
