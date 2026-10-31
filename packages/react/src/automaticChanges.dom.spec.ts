import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { automatic, notesShown, workerCommitted } from "#test/automatic/automatic.ts";

expectNoReactWarnings();

automatic.it(
	"a worker's commit refreshes only the changed note's live query, with no app wiring",
	[notesShown()],
	function* ({ reads, shown, workerCommits }) {
		expect(yield* reads()).toEqual([1, 2]);

		yield* workerCommits(1, "From worker");

		yield* outcomes({
			"note 1": [shown(1), "From worker"],
			"note 2": [shown(2), "Second"],
			reads: [reads(), [1, 1, 2]],
		});
	},
);

automatic.it(
	"a worker's commit publishes the note's keys once in one notification",
	[notesShown()],
	function* ({ notifications, publications, workerCommits }) {
		yield* workerCommits(1, "From worker");

		yield* outcomes({
			notifications: [notifications(), [["notes", "notes:1"]]],
			publications: [publications(), ["notes", "notes:1"]],
		});
	},
);

automatic.it(
	"a worker write that rolls back notifies nothing and leaves the shown title",
	[workerCommitted()],
	function* ({ notifications, shown, workerRollsBack }) {
		yield* workerRollsBack(1, "Rolled back");

		yield* outcomes({
			"note 1": [shown(1), "From worker"],
			notifications: [notifications(), [["notes", "notes:1"]]],
		});
	},
);

automatic.it(
	"a command publishes its declared derived keys once, without repeating the repository's keys",
	[notesShown()],
	function* ({ commandRenames, notifiedKeys, publications }) {
		yield* commandRenames(1, "From command");

		yield* outcomes({
			"notified keys": [notifiedKeys(), ["notes", "notes:1", "summary"]],
			publications: [publications(), ["notes", "notes:1", "summary"]],
		});
	},
);
