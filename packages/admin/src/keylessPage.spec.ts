import { expect } from "vitest";
import { listOpen, openTasks, tasksStory } from "#test/tasksStory.ts";

tasksStory.it(
	"an open list on a page whose browser contract carries no keys refreshes after a command on the page, through the keys its server module declares",
	[openTasks("triage inbox", "rotate keys"), listOpen],
	function* ({ closes, shownTasks, untilRefreshed }) {
		expect(yield* shownTasks()).toEqual(["triage inbox", "rotate keys"]);

		yield* closes("triage inbox");
		yield* untilRefreshed();

		expect(yield* shownTasks()).toEqual(["rotate keys"]);
	},
);

tasksStory.it(
	"an open list on a page whose browser contract carries no keys refreshes after a write elsewhere publishes a key its server module reads",
	[openTasks("triage inbox"), listOpen],
	function* ({ opensElsewhere, shownTasks, untilRefreshed }) {
		expect(yield* shownTasks()).toEqual(["triage inbox"]);

		yield* opensElsewhere("renew certificate");
		yield* untilRefreshed();

		expect(yield* shownTasks()).toEqual(["triage inbox", "renew certificate"]);
	},
);
