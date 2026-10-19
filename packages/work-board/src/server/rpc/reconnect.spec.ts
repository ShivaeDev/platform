import { Effect } from "effect";
import { expect } from "vitest";
import { browserClient } from "#browserClient.ts";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { connectionBoundary } from "#test/connectionBoundary.ts";
import { waitFor } from "#test/live.ts";

boardStory.it(
	"reports a lost HTTP subscription and reconciles an offline edit when it reconnects",
	[projectFiles({ "home.md": "# Home", "note.md": "# Note\n\nBefore the outage." }), boardHome("home.md"), connectionBoundary(browserClient)],
	function* ({ client, waitForConnection, disconnectTransport, resumeTransport, watchProject, changed, editFile }) {
		const query = client.api.document.query({ url: "/note.md" });
		const release = client.registry.mount(query);
		yield* Effect.addFinalizer(() => Effect.sync(release));
		yield* waitForConnection();
		expect((yield* Effect.promise(() => client.read(query))).source).toContain("Before the outage.");
		disconnectTransport();
		yield* Effect.promise(() => waitFor(() => expect(client.registry.get(client.updates.status).connection).toBe("reconnecting")));
		const events = yield* watchProject();
		editFile("note.md", "# Note\n\nWritten while offline.");
		yield* changed(events, "note.md");
		yield* events.close();
		resumeTransport();
		yield* waitForConnection();
		yield* Effect.promise(() =>
			waitFor(() => {
				const read = client.registry.get(query);
				expect(read._tag === "Success" && read.value.source).toContain("Written while offline.");
			}),
		);
	},
);
