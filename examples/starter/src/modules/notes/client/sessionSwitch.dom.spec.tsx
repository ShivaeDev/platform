import { expect } from "vitest";
import { eventually } from "@shivaedev/test-story/client/react.ts";
import { aliceSession, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"replaces cached notes and the draft when the authentication owner's session changes",
	[aliceSession()],
	function* ({ closeScreen, consoleErrors, settleQuery, enter, submit, noteLink, switchSession, savedNote, draft }) {
		yield* settleQuery("list");
		yield* enter("Alice's saved note");
		yield* submit();
		yield* eventually(() => expect(noteLink()).toBe("Alice's saved note"));
		yield* enter("Alice's private draft");
		yield* switchSession("bob");
		yield* settleQuery("list");
		yield* eventually(() => expect(savedNote()).toBeNull());
		yield* eventually(() => expect(draft()).toBe(""));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);
