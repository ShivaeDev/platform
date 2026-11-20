import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { recentQueries, signedIn, warm } from "#test/recent-queries/story.tsx";

recentQueries.it(
	"a warm note that answered before alice opens its screen shows in the screen's first render, with no second read",
	[warm("one"), signedIn],
	function* ({ answer, firstShown, open, reads }) {
		yield* answer("Alice's note");

		yield* open();

		yield* outcomes([
			["first render", firstShown, "Alice's note"],
			["subscription reads", reads, ["one"]],
		]);
	},
);

recentQueries.it(
	"a warm note stays subscribed after alice leaves its screen for longer than retention keeps a result, until she signs out",
	[warm("one"), signedIn],
	function* ({ answer, firstShown, leave, open, pass, reads, shown, signOut, subscriptions }) {
		yield* open();
		yield* answer("Alice's note");
		yield* leave();

		yield* pass("6 minutes");
		yield* open();

		yield* outcomes([
			["first render", firstShown, "Alice's note"],
			["shown note", shown, { stale: false, title: "Alice's note" }],
			["subscription reads", reads, ["one"]],
			["open subscriptions", subscriptions, 1],
		]);

		yield* signOut();

		expect(yield* subscriptions()).toBe(0);
	},
);

recentQueries.it(
	"when the warm list names another note, that note's subscription opens and the note it replaced is kept by retention",
	[warm("one"), signedIn],
	function* ({ answer, firstShown, open, reads, replaceWarm, shown, subscriptions }) {
		yield* answer("Monday's note");

		yield* replaceWarm("one", "two");
		yield* answer("Tuesday's note");

		yield* outcomes([
			["subscription reads", reads, ["one", "two"]],
			["open subscriptions", subscriptions, 1],
		]);

		yield* open("one");

		yield* outcomes([
			["first render", firstShown, "Monday's note"],
			["shown note", shown, { stale: true, title: "Monday's note" }],
		]);
	},
);
