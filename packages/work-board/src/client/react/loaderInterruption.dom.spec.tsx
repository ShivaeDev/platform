import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { screenStory } from "#test/screenStory.ts";
import { observedLoader, pausedDocument, routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();
const files = { "first.md": "# First", "home.md": "# Home", "next.md": "# Next" };

screenStory.it(
	"interrupts the loader Effect when the reader navigates away from a pending document",
	[pausedDocument("/next.md"), routedScreen(files, "/first.md", { home: "home.md" }), observedLoader("/next.md")],
	function* ({ navigate, startNavigation, loaderStarted, loaderFailure }) {
		yield* Effect.promise(() => navigate("/first.md"));
		yield* Effect.promise(() => startNavigation("/next.md"));
		yield* loaderStarted();

		yield* Effect.promise(() => navigate("/first.md"));

		expect(yield* loaderFailure()).toMatchObject({
			cause: expect.objectContaining({ message: "All fibers interrupted without error" }),
			name: "AbortError",
		});
	},
);
