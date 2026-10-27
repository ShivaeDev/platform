import { expect } from "vitest";
import { feedback, notesFeature } from "#test/feedback-path/story.tsx";

feedback.it(
	"Notes load, retry and save through the query and form owners",
	[notesFeature()],
	function* ({ click, complete, observe, readFails, readSucceeds, session, snapshot, submit, type }) {
		yield* observe("the initial query is held", () => {
			expect(session()).toMatchObject({ reads: 1 });
			expect(snapshot()).toMatchObject({ loading: "Loading notes", rows: undefined });
		});
		yield* readFails(1);
		yield* observe("initial failure offers retry", () => {
			expect(snapshot().queryError).toBe("Could not load notes Retry");
			expect(snapshot().notices).toEqual([{ message: "Load failed", outcome: "", pending: false }]);
		});
		yield* click("Retry");
		yield* observe("retry starts a new query", () => expect(session()).toMatchObject({ reads: 2 }));
		yield* readSucceeds(2);
		yield* observe("the real query supplies the content", () => expect(snapshot().rows).toBe("existing"));
		yield* click("Dismiss Load failed");
		yield* type("blocked");
		yield* submit();
		yield* observe("the server rejection belongs to the submitted field", () => {
			expect(snapshot()).toMatchObject({ fieldError: "Choose another title", saving: false, title: "blocked" });
			expect(snapshot().notices).toEqual([]);
		});
		yield* type("new note");
		yield* submit();
		yield* observe("the form save waits for its response", () => {
			expect(session().saves).toEqual(["new note"]);
			expect(snapshot()).toMatchObject({ saving: true, status: "Saving" });
		});
		yield* type("next draft");
		yield* complete("save", "new note");
		yield* observe("submission publishes before the invalidated read finishes", () => {
			expect(session()).toMatchObject({ reads: 3 });
			expect(snapshot()).toMatchObject({
				fieldError: undefined,
				loading: "Refreshing notes",
				rows: "existing",
				saving: false,
				status: "Unsaved",
				title: "next draft",
			});
			expect(snapshot().notices).toEqual([{ message: "Saved new note", outcome: "", pending: false }]);
		});
		yield* readSucceeds(3);
		yield* observe("contract invalidation delivers the saved note", () => expect(snapshot().rows).toBe("existing, new note"));
		yield* click("Refresh");
		yield* observe("refresh starts without unmounting the draft", () => {
			expect(session()).toMatchObject({ reads: 4 });
			expect(snapshot().title).toBe("next draft");
		});
		yield* readFails(4);
		yield* observe("failed refresh retains the last content and the newer draft", () => {
			expect(snapshot()).toMatchObject({ queryError: "Could not load notes Retry", rows: "existing, new note", title: "next draft" });
			expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Saved new note", "Refresh failed"]);
		});
	},
);

feedback.it(
	"Concurrent form and command completions publish their own notices and keep a conflict on its Undo",
	[notesFeature()],
	function* ({ click, complete, observe, readSucceeds, session, snapshot, submit, type }) {
		yield* observe("the initial query starts", () => expect(session()).toMatchObject({ reads: 1 }));
		yield* readSucceeds(1);
		yield* observe("the command controls appear", () => expect(snapshot().rows).toBe("existing"));
		yield* type("concurrent note");
		yield* submit();
		yield* click("Remove first");
		yield* click("Remove second");
		yield* observe("the form and both commands reach the handlers", () =>
			expect(session()).toMatchObject({ removals: ["first", "second"], saves: ["concurrent note"] }),
		);
		yield* complete("remove", "second");
		yield* observe("second publishes while first is still held", () =>
			expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Removed second"]),
		);
		expect(snapshot().saving).toBe(true);
		yield* complete("save", "concurrent note");
		yield* observe("form completion publishes between the command completions", () =>
			expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Removed second", "Saved concurrent note"]),
		);
		yield* complete("remove", "first");
		yield* observe("out-of-order completion preserves both notices", () =>
			expect(snapshot().notices.map((notice) => notice.message)).toEqual(["Removed second", "Saved concurrent note", "Removed first"]),
		);
		yield* click("Remove blocked");
		yield* observe("command failure publishes separately", () =>
			expect(snapshot().notices.map((notice) => notice.message)).toEqual([
				"Removed second",
				"Saved concurrent note",
				"Removed first",
				"Could not remove note",
			]),
		);
		yield* click("Undo second");
		yield* observe("Undo receives the application's payload", () => {
			expect(session().calls).toEqual([{ expectedVersion: 8, title: "second" }]);
			expect(snapshot().notices[0]?.pending).toBe(true);
		});
		yield* complete("restore", "second");
		yield* observe("Undo completes on its own notice", () =>
			expect(snapshot().notices[0]).toMatchObject({ outcome: "Restored second", pending: false }),
		);
		yield* click("Edit first");
		yield* click("Undo first");
		yield* observe("the other notice keeps its original expected version", () =>
			expect(session().calls).toEqual([
				{ expectedVersion: 8, title: "second" },
				{ expectedVersion: 8, title: "first" },
			]),
		);
		yield* complete("restore", "first");
		yield* observe("a command conflict stays on the relevant Undo", () => {
			expect(snapshot().notices[2]?.outcome).toContain("Conflict");
			expect(snapshot().notices[2]?.pending).toBe(false);
			expect(snapshot().notices[0]?.outcome).toBe("Restored second");
		});
		yield* readSucceeds(session().reads);
		yield* observe("Undo invalidation reaches the query", () => expect(snapshot().rows).toBe("existing, concurrent note, second@9"));
	},
);
