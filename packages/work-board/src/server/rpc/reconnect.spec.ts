import { expect } from "vitest";
import { browserClient } from "#browserClient.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { connectionBoundary } from "#test/connectionBoundary.ts";

boardStory.it(
	"reports a lost HTTP subscription and reconciles an offline edit when it reconnects",
	[projectFiles({ "home.md": "# Home", "note.md": "# Note\n\nBefore the outage." }), boardHome("home.md"), connectionBoundary(browserClient)],
	function* ({ client, waitForConnection, disconnectTransport, resumeTransport, edited, mountedRead, nextRead }) {
		const query = client.api.document.query({ url: "/note.md" });
		const before = yield* mountedRead(query);
		yield* waitForConnection();
		expect(before.source).toContain("Before the outage.");

		disconnectTransport();
		yield* waitForConnection("reconnecting");
		yield* edited("note.md", "# Note\n\nWritten while offline.");
		resumeTransport();
		yield* waitForConnection();

		expect((yield* nextRead(query, before)).source).toContain("Written while offline.");
	},
);
