import { describe, expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardHome, boardStory, projectFiles, readerAt } from "#test/boardStory.ts";
import { PLAN } from "#test/live.ts";

// These stories drive the built bundle in a page because only real window.history restores selection and details.
const reader = [
	projectFiles({ "home.md": "# Home", "other.md": "# Other\n\nNext page.", "plan.md": PLAN.replace("# Plan", "# Plan\n\n## Reading") }),
	boardHome("home.md"),
	readerAt("/plan.md"),
];

describe("document navigation", () => {
	boardStory.it(
		"opens a followed link in the same page without the browser reloading it",
		reader,
		function* ({ bundleLocation, bundlePageReady, followInBundle }) {
			yield* bundlePageReady();
			expect(yield* bundleLocation()).toEqual({ address: "/plan.md", heading: "Plan", visit: "kept" });

			yield* followInBundle("/other.md");

			expect(yield* bundleLocation()).toEqual({ address: "/other.md", heading: "Other", visit: "kept" });
		},
	);

	boardStory.it(
		"reopens the details and reselects the text the reader left when they go back",
		reader,
		function* ({ bundleLocation, bundlePageReady, bundleReading, followInBundle, goBackInBundle, openBundleDetails, selectBundleText }) {
			yield* bundlePageReady();
			yield* openBundleDetails();
			yield* selectBundleText(5);
			yield* followInBundle("/other.md");
			expect(yield* bundleReading()).toEqual({ details: "none", selection: "" });

			yield* goBackInBundle("/plan.md");

			yield* outcomes([
				["the page", () => bundleLocation(), { address: "/plan.md", heading: "Plan", visit: "kept" }],
				["the reading", () => bundleReading(), { details: "open", selection: "Intro" }],
			]);
		},
	);

	boardStory.it(
		"returns to the page the reader went back from when they go forward",
		reader,
		function* ({ bundleLocation, bundlePageReady, followInBundle, goBackInBundle, goForwardInBundle }) {
			yield* bundlePageReady();
			yield* followInBundle("/other.md");
			yield* goBackInBundle("/plan.md");

			yield* goForwardInBundle("/other.md");

			expect(yield* bundleLocation()).toEqual({ address: "/other.md", heading: "Other", visit: "kept" });
		},
	);
});
