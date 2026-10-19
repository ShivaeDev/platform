import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { pausedDocument, routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const files = {
	"home.md": "# Home\n\n## Plans\n",
	"notes/first.md": "# First\n\n<details><summary>Evidence</summary>Retained evidence</details>\n",
	"notes/next.md": "# Next\n",
};

for (const back of [false, true]) {
	screenStory.it(
		`clears the old document while loading and handles back before the read completes (back: ${back})`,
		[pausedDocument("/notes/next.md"), routedScreen(files, "/notes/first.md", { home: "home.md" })],
		function* ({ startNavigation, finishNavigation, back: goBack, openDetails, location, readStarted, releaseRead, readText, findElement }) {
			yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("First")));
			yield* Effect.promise(() => eventually(() => expect(findElement<HTMLElement>("#doc")?.dataset.route).toBe("/notes/first.md")));
			const main = findElement("main");
			openDetails("article details");
			yield* Effect.promise(() => startNavigation("/notes/next.md"));
			yield* Effect.promise(() => eventually(() => expect(readStarted()).toBe(true)));
			expect(location()?.pathname).toBe("/notes/next.md");
			expect(findElement("#doc h1")).toBeNull();
			expect(readText("#doc [role=status]")).toBe("Loading page");
			expect(findElement('#doc [data-loading-shape="document"]')).not.toBeNull();
			if (back) {
				yield* Effect.promise(() => goBack());
				yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("First")));
			}
			yield* Effect.promise(releaseRead);
			yield* Effect.promise(() => finishNavigation());
			yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe(back ? "First" : "Next")));
			expect(findElement("main")).toBe(main);
			if (back) {
				yield* Effect.promise(() => eventually(() => expect(findElement<HTMLDetailsElement>("article details")?.open).toBe(true)));
			}
		},
	);
}

screenStory.it(
	"keeps document navigation and back navigation in the same shell",
	[routedScreen(files, "/notes/first.md")],
	function* ({ readText, findElement, navigate, back }) {
		const main = findElement("main");
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("First")));
		yield* Effect.promise(() => navigate("/notes/next.md"));
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Next")));
		yield* Effect.promise(back);
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("First")));
		expect(findElement("main")).toBe(main);
	},
);
