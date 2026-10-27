import { expect } from "vitest";
import { eventually } from "@shivaedev/react/client/testing.ts";
import { aliceSession, screens } from "#modules/notes/test-support/screens.ts";

screens.it(
	"replaces cached notes and the draft when the authentication owner's session changes",
	[aliceSession()],
	function* ({ closeScreen, consoleErrors, noteCalls, enter, submit, noteLink, switchSession, savedNote, draft }) {
		yield* eventually(() => expect(noteCalls()).toContain("list"));
		yield* enter("Alice's saved note");
		yield* submit();
		yield* eventually(() => expect(noteLink()).toBe("Alice's saved note"));
		yield* enter("Alice's private draft");
		yield* switchSession("bob");
		yield* eventually(() => expect(noteCalls()).toContain("list"));
		yield* eventually(() => expect(savedNote()).toBeNull());
		yield* eventually(() => expect(draft()).toBe(""));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);
