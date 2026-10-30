import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceSaved, editorsOpen, firstSaveDelivered, firstSaveWaitingAtCommit, settingsStory } from "#test/settings-example/story.ts";

const TIMEOUT = 20_000;

settingsStory.it(
	"an entity without stored settings shows the schema's defaults and stores nothing",
	[editorsOpen("writer")],
	function* ({ storedSettings, view }) {
		yield* outcomes({
			stored: [storedSettings(), []],
			writer: [view("writer"), { connection: "live", error: "", pageSize: "25", status: "Saved", title: "Workspace", value: "Workspace / 25" }],
		});
	},
	TIMEOUT,
);

settingsStory.it(
	"while the first save waits before its commit, nothing is stored and the other editor still shows the defaults",
	[firstSaveWaitingAtCommit()],
	function* ({ storedSettings, view }) {
		yield* outcomes({
			reader: [view("reader"), expect.objectContaining({ pageSize: "25", title: "Workspace", value: "Workspace / 25" })],
			stored: [storedSettings(), []],
		});
	},
	TIMEOUT,
);

settingsStory.it(
	"the first save's commit stores one row and delivers it to the other open editor",
	[firstSaveWaitingAtCommit()],
	function* ({ releaseCommit, storedSettings, view }) {
		yield* releaseCommit();

		yield* outcomes({
			reader: [view("reader"), expect.objectContaining({ pageSize: "50", status: "Saved", title: "Alice's table", value: "Alice's table / 50" })],
			stored: [storedSettings(), [{ entityId: 1, pageSize: 50, title: "Alice's table" }]],
		});
	},
	TIMEOUT,
);

settingsStory.it(
	"a later save replaces the stored row and both editors show it",
	[firstSaveDelivered()],
	function* ({ edit, save, storedSettings, view }) {
		yield* edit("writer", "title", "Alice's compact table");
		yield* edit("writer", "pageSize", "10");

		yield* save("writer");

		const replaced = expect.objectContaining({
			pageSize: "10",
			status: "Saved",
			title: "Alice's compact table",
			value: "Alice's compact table / 10",
		});
		yield* outcomes({
			reader: [view("reader"), replaced],
			stored: [storedSettings(), [{ entityId: 1, pageSize: 10, title: "Alice's compact table" }]],
			writer: [view("writer"), replaced],
		});
	},
	TIMEOUT,
);

settingsStory.it(
	"saving a page size over 100 shows the server's field error beside the kept draft and stores nothing",
	[editorsOpen("writer")],
	function* ({ edit, save, storedSettings, view }) {
		yield* edit("writer", "pageSize", "101");

		yield* save("writer");

		yield* outcomes({
			stored: [storedSettings(), []],
			writer: [
				view("writer"),
				expect.objectContaining({ error: "Choose between 1 and 100 rows", pageSize: "101", status: "Unsaved changes", value: "Workspace / 25" }),
			],
		});
	},
	TIMEOUT,
);

settingsStory.it(
	"the service rejects a page size over 100 from an HTTP caller and stores nothing",
	[editorsOpen("writer")],
	function* ({ answers, saveAs, storedSettings }) {
		yield* saveAs("alice", 1, { pageSize: 101, title: "Invalid" });

		yield* outcomes({
			answers: [answers(), ["rejected as InvalidSettings on pageSize: Choose between 1 and 100 rows"]],
			stored: [storedSettings(), []],
		});
	},
	TIMEOUT,
);

const aliceRow = { entityId: 1, pageSize: 25, title: "Alice only" };

for (const [when, traits, stored] of [
	["before alice saves", [editorsOpen("writer", "bob")], []],
	["after alice saved", [aliceSaved()], [aliceRow]],
] as const) {
	settingsStory.it(
		`bob's query for alice's entity is refused as Missing ${when}`,
		traits,
		function* ({ answers, queryAs }) {
			yield* queryAs("bob", 1);

			expect(yield* answers()).toEqual(["rejected as Missing"]);
		},
		TIMEOUT,
	);

	settingsStory.it(
		`bob's save to alice's entity is refused as Missing ${when} and changes nothing stored`,
		traits,
		function* ({ answers, saveAs, storedSettings }) {
			yield* saveAs("bob", 1, { pageSize: 90, title: "Stolen" });

			yield* outcomes({
				answers: [answers(), ["rejected as Missing"]],
				stored: [storedSettings(), stored],
			});
		},
		TIMEOUT,
	);
}

settingsStory.it(
	"bob's save stores his own entity's row beside alice's and leaves alice's editor alone",
	[aliceSaved()],
	function* ({ edit, save, storedSettings, view }) {
		yield* edit("bob", "title", "Bob only");
		yield* edit("bob", "pageSize", "75");

		yield* save("bob");

		yield* outcomes({
			bob: [view("bob"), expect.objectContaining({ pageSize: "75", title: "Bob only", value: "Bob only / 75" })],
			stored: [storedSettings(), [aliceRow, { entityId: 2, pageSize: 75, title: "Bob only" }]],
			writer: [view("writer"), expect.objectContaining({ pageSize: "25", title: "Alice only", value: "Alice only / 25" })],
		});
	},
	TIMEOUT,
);
