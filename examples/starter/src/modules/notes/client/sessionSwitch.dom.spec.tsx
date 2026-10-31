import { expect } from "vitest";
import { aliceSession, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"replaces cached notes and the draft when the authentication owner's session changes",
	[aliceSession()],
	function* ({ settle, closeScreen, consoleErrors, settleQuery, enter, submit, noteLink, switchSession, savedNote, draft }) {
		yield* settleQuery("list");
		yield* enter("Alice's saved note");
		yield* submit();
		yield* settle();
		expect(noteLink()).toBe("Alice's saved note");
		yield* enter("Alice's private draft");
		yield* switchSession("bob");
		yield* settleQuery("list");
		yield* settle();
		expect(savedNote()).toBeNull();
		expect(draft()).toBe("");
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);
