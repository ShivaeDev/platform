import { expect } from "vitest";
import { commitIsHeld, editors, settingsStory } from "#test/settings-example/story.ts";

settingsStory.it(
	"defaults become one saved row and live values in a second client's open editor",
	[commitIsHeld(), editors("writer", "reader")],
	function* ({ view, storedSettings, observe, edit, save, settle, commitHasEntered, releaseCommit }) {
		yield* observe("both editors show defaults with live subscriptions", () => {
			for (const name of ["writer", "reader"]) {
				expect(view(name)).toMatchObject({
					connection: "live",
					pageSize: "25",
					status: "Saved",
					title: "Workspace",
					value: "Workspace / 25",
				});
			}
		});
		expect(yield* storedSettings()).toEqual([]);
		yield* edit("writer", "title", "Alice's table");
		yield* edit("writer", "pageSize", "50");
		yield* save("writer");
		yield* commitHasEntered();
		expect(yield* storedSettings()).toEqual([]);
		expect(view("reader")).toMatchObject({ pageSize: "25", title: "Workspace", value: "Workspace / 25" });
		yield* releaseCommit();
		yield* settle("writer");
		yield* observe("the independent reader receives the committed settings", () => {
			expect(view("reader")).toMatchObject({
				pageSize: "50",
				status: "Saved",
				title: "Alice's table",
				value: "Alice's table / 50",
			});
		});
		expect(yield* storedSettings()).toEqual([{ entityId: 1, pageSize: 50, title: "Alice's table" }]);
		yield* edit("writer", "title", "Alice's compact table");
		yield* edit("writer", "pageSize", "10");
		yield* save("writer");
		yield* settle("writer");
		yield* observe("both clients receive the replacement values", () => {
			for (const name of ["writer", "reader"]) {
				expect(view(name)).toMatchObject({
					pageSize: "10",
					status: "Saved",
					title: "Alice's compact table",
					value: "Alice's compact table / 10",
				});
			}
		});
		expect(yield* storedSettings()).toEqual([{ entityId: 1, pageSize: 10, title: "Alice's compact table" }]);
	},
	20_000,
);

settingsStory.it(
	"the server's typed rejection becomes a form field error without storing settings",
	[editors("writer")],
	function* ({ observe, view, edit, save, settle, storedSettings, saveAs }) {
		yield* settle("writer");
		yield* edit("writer", "pageSize", "101");
		yield* save("writer");
		yield* settle("writer");
		yield* observe("the invalid input remains beside its field error", () => {
			expect(view("writer")).toMatchObject({
				error: "Choose between 1 and 100 rows",
				pageSize: "101",
				status: "Unsaved changes",
				value: "Workspace / 25",
			});
		});
		expect(yield* storedSettings()).toEqual([]);
		expect(yield* saveAs("alice-session", 1, { pageSize: 101, title: "Invalid" })).toMatchObject({
			_tag: "Failure",
			failure: {
				_tag: "InvalidSettings",
				field: "pageSize",
				message: "Choose between 1 and 100 rows",
			},
		});
		expect(yield* storedSettings()).toEqual([]);
	},
	20_000,
);

settingsStory.it(
	"ownership protects absent defaults, saved queries and upserts",
	[editors("writer", "bob")],
	function* ({ queryAs, saveAs, observe, view, edit, save, settle, storedSettings }) {
		yield* observe("both owners load their own defaults and live subscriptions", () => {
			for (const name of ["writer", "bob"]) {
				expect(view(name)).toMatchObject({
					connection: "live",
					pageSize: "25",
					title: "Workspace",
					value: "Workspace / 25",
				});
			}
		});
		expect(yield* queryAs("bob-session", 1)).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Missing" },
		});
		expect(yield* saveAs("bob-session", 1, { pageSize: 90, title: "Stolen" })).toMatchObject({ _tag: "Failure", failure: { _tag: "Missing" } });
		expect(yield* storedSettings()).toEqual([]);
		yield* settle("writer");
		yield* settle("bob");
		yield* edit("writer", "title", "Alice only");
		yield* save("writer");
		yield* settle("writer");
		expect(yield* queryAs("bob-session", 1)).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Missing" },
		});
		expect(yield* saveAs("bob-session", 1, { pageSize: 80, title: "Overwritten" })).toMatchObject({ _tag: "Failure", failure: { _tag: "Missing" } });
		yield* edit("bob", "title", "Bob only");
		yield* edit("bob", "pageSize", "75");
		yield* save("bob");
		yield* settle("bob");
		yield* observe("each owner's open editor shows only its entity", () => {
			expect(view("writer")).toMatchObject({
				pageSize: "25",
				title: "Alice only",
				value: "Alice only / 25",
			});
			expect(view("bob")).toMatchObject({
				pageSize: "75",
				title: "Bob only",
				value: "Bob only / 75",
			});
		});
		expect(yield* queryAs("alice-session", 2)).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Missing" },
		});
		expect(yield* storedSettings()).toEqual([
			{ entityId: 1, pageSize: 25, title: "Alice only" },
			{ entityId: 2, pageSize: 75, title: "Bob only" },
		]);
	},
	20_000,
);
