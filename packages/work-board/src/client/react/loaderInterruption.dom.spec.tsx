import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { laterReadHeld, readingPage } from "#test/readingScreenTraits.tsx";
import { screenStory } from "#test/screenStory.ts";
import { observedLoader } from "#test/screenTraits.ts";

expectNoReactWarnings();
const files = { "first.md": "# First", "home.md": "# Home", "next.md": "# Next" };

screenStory.it(
	"navigating away from a document that is still loading interrupts its loader",
	[readingPage(files, "/first.md", { home: "home.md" }), laterReadHeld("/next.md"), observedLoader("/next.md")],
	function* ({ loaderFailure, loaderStarted, navigate, startNavigation }) {
		yield* startNavigation("/next.md");
		yield* loaderStarted();

		yield* navigate("/first.md");

		expect(yield* loaderFailure()).toBe("AbortError: All fibers interrupted without error");
	},
);
