import { expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { connectionBoundary } from "#test/connectionBoundary.ts";

boardStory.it(
	"an edit made while the native connection is offline reaches a mounted document once it reconnects",
	[projectFiles({ "home.md": "# Home", "note.md": "# Note\n\nBefore the outage." }), boardHome("home.md"), connectionBoundary],
	function* ({ connectionBecomes, disconnectTransport, edited, mountedUpdate, mounts, resumeTransport }) {
		expect(yield* mounts("the note")).toContain("Before the outage.");
		disconnectTransport();
		yield* connectionBecomes("reconnecting");

		yield* edited("note.md", "# Note\n\nWritten while offline.");
		resumeTransport();

		expect(yield* mountedUpdate("the note")).toContain("Written while offline.");
	},
);
