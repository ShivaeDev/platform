import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { loaderScreen, noteLeftAfterShowing } from "#test/loaderScreen.tsx";

loaderScreen.it(
	"following the Note link after the note was renamed elsewhere shows the new title from its first render, with one server read per visit",
	[noteLeftAfterShowing("Original note")],
	function* ({ clickLink, firstRenders, rename, serverCalls, shownTitle }) {
		yield* rename("Changed note");
		const before = (yield* firstRenders()).length;

		yield* clickLink("Note");

		yield* outcomes({
			"renders since the visit": [Effect.map(firstRenders(), (titles) => [...new Set(titles.slice(before))]), ["Changed note"]],
			"server calls": [serverCalls(), ["get", "get"]],
			"shown title": [shownTitle(), "Changed note"],
		});
	},
);
