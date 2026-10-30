import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { noteWindow, runtimeTime } from "#test/runtimeTime.ts";

runtimeTime.it("announced edits share the default 20 ms window on the runtime clock", [], function* ({ advance, edit, shown, timesRead }) {
	yield* edit("Changed");
	yield* advance(19);
	yield* edit("Newest");

	yield* outcomes({
		"note 1 before the window closes": [shown("note 1"), "One"],
		"the list before the window closes": [shown("the list"), ["One", "Two"]],
	});

	yield* advance(1);

	yield* outcomes({
		"note 1": [shown("note 1"), "Newest"],
		"note 1's reads": [timesRead("note 1"), "read 3 times"],
		"the list": [shown("the list"), ["Newest", "Two"]],
		"the list's reads": [timesRead("the list"), "read 3 times"],
	});
});

runtimeTime.it("a query's own window also uses the runtime clock", [noteWindow(1000)], function* ({ advance, edit, shown, timesRead }) {
	yield* edit("Changed");
	yield* advance(20);

	yield* outcomes({
		"note 1 before its window closes": [shown("note 1"), "One"],
		"the list after its window closes": [shown("the list"), ["Changed", "Two"]],
	});

	yield* advance(980);

	yield* outcomes({
		"note 1": [shown("note 1"), "Changed"],
		"note 1's reads": [timesRead("note 1"), "read 3 times"],
		"the list's reads": [timesRead("the list"), "read 3 times"],
	});
});

runtimeTime.it("a resync cancels a queued window instead of re-reading twice", [], function* ({ advance, edit, resync, shown, timesRead }) {
	yield* edit("Changed");
	yield* resync();
	yield* outcomes({ "note 1": [shown("note 1"), "Changed"] });
	yield* advance(20);

	yield* outcomes({
		"note 1's reads": [timesRead("note 1"), "read 3 times"],
		"the list's reads": [timesRead("the list"), "read 3 times"],
	});
});

runtimeTime.it("pausing before the window closes leaves the queued edit unread", [], function* ({ advance, edit, pause, shown, timesRead }) {
	yield* edit("Changed");
	pause();
	yield* advance(20);

	yield* outcomes({
		"note 1": [shown("note 1"), "One"],
		"note 1's reads": [timesRead("note 1"), "read twice"],
		"the list's reads": [timesRead("the list"), "read twice"],
	});
});

runtimeTime.it("disposing the registry cancels its queued window", [], function* ({ advance, dispose, edit, timesRead }) {
	yield* edit("Changed");
	dispose();
	yield* advance(20);

	yield* outcomes({
		"note 1's reads": [timesRead("note 1"), "read twice"],
		"the list's reads": [timesRead("the list"), "read twice"],
	});
});
