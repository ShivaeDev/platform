import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { connectionBoundary } from "#test/connectionBoundary.ts";
import { liveClientSubscribed } from "#test/liveTraits.ts";

const project = [
	projectFiles({ "home.md": "# Home", "note.md": "# Note\n\nBefore the outage." }),
	boardHome("home.md"),
	connectionBoundary,
	liveClientSubscribed,
];

boardStory.it(
	"a live update lost while the socket is offline reaches the mounted document when it reconnects",
	project,
	function* ({ changeShowing, connectionBecomes, disconnectTransport, editFile, mountedUpdate, mounts, resumeTransport }) {
		expect(yield* mounts("the note")).toContain("Before the outage.");
		disconnectTransport();
		yield* connectionBecomes("reconnecting");

		editFile("note.md", "# Note\n\nWritten while offline.");
		yield* changeShowing("note.md", "Written while offline.");
		resumeTransport();

		expect(yield* mountedUpdate("the note")).toBe("# Note\n\nWritten while offline.");
	},
);

boardStory.it(
	"holding socket traffic keeps the connection live and the document's first read until release delivers the edited source",
	project,
	function* ({ changeShowing, connectionState, editFile, holdTransport, mountedKept, mountedUpdate, mounts, resumeTransport }) {
		expect(yield* mounts("the note")).toContain("Before the outage.");
		holdTransport();

		editFile("note.md", "# Note\n\nWritten while held.");
		yield* changeShowing("note.md", "Written while held.");

		yield* outcomes([
			["mounted document", () => mountedKept("the note"), "the first read"],
			["connection", () => connectionState(), "live"],
		]);

		resumeTransport();

		expect(yield* mountedUpdate("the note")).toBe("# Note\n\nWritten while held.");
	},
);

boardStory.it(
	"closing the socket with a held update reconnects the mounted document to the latest disk contents",
	project,
	function* ({
		changeShowing,
		connectionBecomes,
		disconnectTransport,
		editFile,
		holdTransport,
		mountedKept,
		mountedUpdate,
		mounts,
		resumeTransport,
	}) {
		expect(yield* mounts("the note")).toContain("Before the outage.");
		holdTransport();
		editFile("note.md", "# Note\n\nDelivery in flight.");
		yield* changeShowing("note.md", "Delivery in flight.");
		expect(yield* mountedKept("the note")).toBe("the first read");

		disconnectTransport();
		yield* connectionBecomes("reconnecting");
		editFile("note.md", "# Note\n\nLatest source after interruption.");
		yield* changeShowing("note.md", "Latest source after interruption.");
		resumeTransport();

		expect(yield* mountedUpdate("the note")).toBe("# Note\n\nLatest source after interruption.");
	},
);
