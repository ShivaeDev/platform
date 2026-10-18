import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-react/client/testing.ts";
import { aliceSession, screens } from "#test-support/screens.ts";

screens.it(
	"replaces cached notes and the draft when the authentication owner's session changes",
	[aliceSession()],
	function* ({ closeScreen, consoleErrors, noteCalls, enter, submit, noteLink, switchSession, savedNote, draft }) {
		yield* Effect.promise(() => eventually(() => expect(noteCalls()).toContain("list")));
		yield* enter("Alice's saved note");
		yield* submit();
		yield* Effect.promise(() => eventually(() => expect(noteLink()).toBe("Alice's saved note")));
		yield* enter("Alice's private draft");
		yield* switchSession("bob");
		yield* Effect.promise(() => eventually(() => expect(noteCalls()).toContain("list")));
		yield* Effect.promise(() => eventually(() => expect(savedNote()).toBeNull()));
		yield* Effect.promise(() => eventually(() => expect(draft()).toBe("")));
		yield* closeScreen();
		expect(consoleErrors()).toEqual([]);
	},
);
