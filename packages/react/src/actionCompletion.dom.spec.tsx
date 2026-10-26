import { expect } from "vitest";
import { commandScreen, commands } from "#test/command-completion/story.tsx";

commands.it(
	"Concurrent command completions retain their own inputs",
	[commandScreen({ concurrent: true })],
	function* ({ click, complete, observe, snapshot }) {
		yield* click("first");
		yield* click("second");
		yield* observe("both commands reach the handler", () => expect(snapshot().calls).toEqual(["first", "second"]));
		yield* complete("second", "B");
		yield* observe("second completes while first is held", () => expect(snapshot().notices).toEqual(["original: second -> B"]));
		expect(snapshot().pending).toBe("true");
		yield* complete("first", "A");
		yield* observe("each completion has its input", () => expect(snapshot().notices).toEqual(["original: second -> B", "original: first -> A"]));
	},
);

commands.it("Completion uses the current callback", [commandScreen()], function* ({ click, complete, render, observe, snapshot }) {
	yield* click("first");
	yield* observe("the command is held", () => expect(snapshot().calls).toEqual(["first"]));
	yield* render({ callback: "current" });
	yield* complete("first", "A");
	yield* observe("the committed callback presents completion", () => expect(snapshot().notices).toEqual(["current: first -> A"]));
});

commands.it("Superseded command produces no notice", [commandScreen()], function* ({ click, complete, observe, snapshot }) {
	yield* click("first");
	yield* observe("first starts", () => expect(snapshot().calls).toEqual(["first"]));
	yield* click("second");
	yield* observe("superseding interrupts first", () => expect(snapshot().finished).toContain("first"));
	yield* complete("first", "A");
	yield* complete("second", "B");
	yield* observe("only second reports completion", () => expect(snapshot().notices).toEqual(["original: second -> B"]));
});

commands.it(
	"Session replacement discards outgoing completion",
	[commandScreen({ uninterruptible: true })],
	function* ({ click, complete, render, observe, snapshot }) {
		yield* click("first");
		yield* observe("outgoing command starts", () => expect(snapshot().calls).toEqual(["first"]));
		yield* render({ callback: "bob", session: "bob" });
		yield* complete("first", "A");
		yield* observe("outgoing work finishes", () => expect(snapshot().finished).toContain("first"));
		expect(snapshot().notices).toEqual([]);
		yield* click("second");
		yield* observe("new owner can dispatch", () => expect(snapshot().calls).toEqual(["first", "second"]));
		yield* complete("second", "B");
		yield* observe("new owner reports its completion", () => expect(snapshot().notices).toEqual(["bob: second -> B"]));
	},
);

commands.it(
	"Completion neither duplicates invalidation nor waits for refetch or replays on rerender",
	[commandScreen()],
	function* ({ click, complete, render, observe, snapshot }) {
		yield* observe("initial query is loaded", () => expect(snapshot()).toMatchObject({ reads: 1 }));
		yield* click("first");
		yield* observe("command starts", () => expect(snapshot().calls).toEqual(["first"]));
		yield* complete("first", "A");
		yield* observe("completion runs while the invalidated query waits", () => {
			expect(snapshot()).toMatchObject({ invalidations: 1, notices: ["original: first -> A"], pending: "false", queryPending: "true", reads: 2 });
		});
		yield* render();
		expect(snapshot()).toMatchObject({ invalidations: 1, notices: ["original: first -> A"], reads: 2 });
	},
);

commands.it(
	"Typed rejection reports its invocation and Unauthorized rechecks once without signing out",
	[commandScreen()],
	function* ({ click, reject, render, observe, snapshot }) {
		yield* click("first");
		yield* observe("first starts", () => expect(snapshot().calls).toEqual(["first"]));
		yield* reject("first");
		yield* observe("typed failure is presented", () => expect(snapshot().notices).toEqual(["original: first rejected: Rejected"]));
		yield* click("second");
		yield* observe("second starts", () => expect(snapshot().calls).toEqual(["first", "second"]));
		yield* reject("second", true);
		yield* observe("one session recheck runs for the invocation", () => expect(snapshot()).toMatchObject({ rechecks: 1 }));
		yield* render();
		expect(snapshot()).toMatchObject({
			invalidations: 0,
			notices: ["original: first rejected: Rejected", "original: second rejected: Unauthorized"],
			rechecks: 1,
		});
		expect(snapshot().cause).toContain("Unauthorized");
	},
);

commands.it("A presentation defect is not a domain rejection", [commandScreen({ defect: true })], function* ({ click, complete, observe, snapshot }) {
	yield* click("first");
	yield* observe("first starts", () => expect(snapshot().calls).toEqual(["first"]));
	yield* complete("first", "A");
	yield* observe("the defect stays in the native cause", () => expect(snapshot().cause).toContain("Presentation failed"));
	expect(snapshot()).toMatchObject({ notices: [], rechecks: 0 });
});

commands.it(
	"An abandoned render cannot replace the committed completion callback",
	[commandScreen()],
	function* ({ click, complete, suspend, observe, snapshot }) {
		yield* click("first");
		yield* observe("first starts", () => expect(snapshot().calls).toEqual(["first"]));
		yield* suspend();
		yield* observe("the new callback rendered without committing", () => expect(snapshot().attempts).toContain("uncommitted"));
		yield* complete("first", "A");
		yield* observe("completion uses the committed callback", () => expect(snapshot().notices).toEqual(["original: first -> A"]));
	},
);

commands.it(
	"Concurrent Unauthorized failures each recheck their session once",
	[commandScreen({ concurrent: true })],
	function* ({ click, reject, render, observe, snapshot }) {
		yield* click("first");
		yield* click("second");
		yield* observe("both commands start", () => expect(snapshot().calls).toEqual(["first", "second"]));
		yield* reject("second", true);
		yield* reject("first", true);
		yield* observe("each failure has its own input and session recheck", () =>
			expect(snapshot()).toMatchObject({
				notices: ["original: second rejected: Unauthorized", "original: first rejected: Unauthorized"],
				rechecks: 2,
			}),
		);
		yield* render();
		expect(snapshot()).toMatchObject({ rechecks: 2 });
	},
);

commands.it(
	"Session replacement discards outgoing rejection and session recheck",
	[commandScreen({ uninterruptible: true })],
	function* ({ click, reject, render, observe, snapshot }) {
		yield* click("first");
		yield* observe("outgoing command starts", () => expect(snapshot().calls).toEqual(["first"]));
		yield* render({ session: "bob" });
		yield* reject("first", true);
		yield* observe("outgoing command finishes", () => expect(snapshot().finished).toContain("first"));
		expect(snapshot()).toMatchObject({ notices: [], rechecks: 0 });
	},
);
