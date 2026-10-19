import { expect } from "vitest";
import { liveSessionStory } from "#test/live-session/story.tsx";

liveSessionStory.it(
	"stream revalidation shows sign-in without another query read",
	[],
	function* ({ observe, ready, reads, rechecks, signOut, text }) {
		yield* observe("the open page is live", () => expect(ready()).toBe(true));
		const before = reads();
		yield* signOut();
		yield* observe("the boundary shows sign-in after stream revalidation", () => expect(text()).toBe("Sign in"));
		expect(reads()).toBe(before);
		const streamFailure = 1;
		expect(rechecks()).toBe(streamFailure);
	},
);

liveSessionStory.it("an ended session stops live reconnects", [], function* ({ active, lookups, observe, ready, signOut, wait }) {
	yield* observe("the open page is live", () => expect(ready()).toBe(true));
	yield* signOut();
	const noStreams = 0;
	yield* observe("the server ends the authenticated stream", () => expect(active()).toBe(noStreams));
	const before = lookups();
	yield* wait(1200);
	expect(lookups()).toBe(before);
});

liveSessionStory.it("signing in again restores automatic live updates", [], function* ({ observe, ready, rename, signIn, signOut, text }) {
	yield* observe("the open page is live", () => expect(ready()).toBe(true));
	yield* signOut();
	yield* observe("the boundary shows sign-in", () => expect(text()).toBe("Sign in"));
	yield* signIn();
	yield* observe("the new session is live", () => expect(ready()).toBe(true));
	yield* rename("After sign-in");
	yield* observe("a live hint refreshes the new session's query", () => expect(text()).toBe("After sign-in"));
});
