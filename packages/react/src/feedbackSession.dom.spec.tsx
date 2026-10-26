import { expect } from "vitest";
import { feedback, notesFeature } from "#test/feedback-path/story.tsx";

feedback.it(
	"Replacing a busy session isolates its registry, completions and retained notice handlers",
	[notesFeature({ uninterruptible: true })],
	function* ({
		click,
		complete,
		dismissRetainedNotice,
		observe,
		readSucceeds,
		replaceSession,
		retainNotice,
		runRetainedAction,
		session,
		snapshot,
		type,
	}) {
		yield* observe("Alice's query starts", () => expect(session()).toMatchObject({ reads: 1 }));
		yield* readSucceeds(1);
		yield* observe("Alice's content loads", () => expect(snapshot().rows).toBe("existing"));
		yield* click("Remove first");
		yield* observe("Alice's removal starts", () => expect(session().removals).toEqual(["first"]));
		yield* complete("remove", "first");
		yield* observe("Alice receives Undo", () => expect(snapshot().notices[0]?.message).toBe("Removed first"));
		retainNotice("Removed first");
		yield* click("Undo first");
		yield* click("Remove second");
		yield* type("Alice's draft");
		yield* observe("an Undo and another command are active", () => {
			expect(session()).toMatchObject({
				callbacks: ["alice: first"],
				calls: [{ expectedVersion: 8, title: "first" }],
				removals: ["first", "second"],
			});
			expect(session().nodes[0]).toBeGreaterThan(0);
			expect(snapshot().notices[0]?.pending).toBe(true);
		});
		yield* replaceSession("bob");
		yield* observe("the outgoing registry is disposed and Bob starts fresh", () => {
			expect(session("alice").nodes).toEqual([0]);
			expect(session()).toMatchObject({ reads: 1 });
			expect(snapshot()).toMatchObject({ loading: "Loading notes", notices: [], rows: undefined });
		});
		yield* readSucceeds(1);
		yield* observe("Bob's content has no inherited draft", () => expect(snapshot()).toMatchObject({ notices: [], rows: "existing", title: "" }));
		yield* click("Remove first");
		yield* observe("Bob can issue the same command", () => expect(session().removals).toEqual(["first"]));
		yield* complete("remove", "first");
		yield* observe("Bob's host publishes its own notice", () => expect(snapshot().notices[0]?.message).toBe("Removed first"));
		yield* complete("remove", "second", "alice");
		yield* complete("restore", "first", "alice");
		yield* observe("outgoing uninterruptible work finishes without publishing", () => {
			expect(session("alice").finished).toContain("second");
			expect(session("alice").released).toEqual(["first"]);
		});
		yield* runRetainedAction();
		yield* dismissRetainedNotice();
		expect(session("alice")).toMatchObject({ callbacks: ["alice: first"], calls: [{ expectedVersion: 8, title: "first" }], nodes: [0] });
		expect(session().callbacks).toEqual(["bob: first"]);
		expect(snapshot().notices).toEqual([{ message: "Removed first", outcome: "", pending: false }]);
		yield* click("Undo first");
		yield* observe("only Bob's live action runs", () => expect(session().calls).toEqual([{ expectedVersion: 8, title: "first" }]));
		yield* complete("restore", "first");
		yield* observe("Bob's action can still complete", () => expect(snapshot().notices[0]?.outcome).toBe("Restored first"));
		yield* readSucceeds(session().reads);
		yield* observe("Bob's registry receives only his content", () => expect(snapshot().rows).toBe("existing, first@9"));
	},
);
