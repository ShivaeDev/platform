import { expect } from "vitest";
import { liveSessionStory } from "#test/live-session/story.tsx";

liveSessionStory.it(
	"one hint replaces an open note with read denied after Alice loses read access and closes her subscription",
	[],
	function* ({ active, denyRead, rename, subscribers, text, untilQueryFails, untilQueryReady }) {
		yield* untilQueryReady();
		expect(text()).toBe("First");
		expect(subscribers()).toEqual(["alice"]);

		yield* denyRead();
		yield* rename("Private after denial");
		yield* untilQueryFails();

		expect(text()).toBe("Read denied");
		expect(active()).toBe(0);

		yield* rename("Another private change");

		expect(text()).toBe("Read denied");
		expect(active()).toBe(0);
	},
);

liveSessionStory.it(
	"stream revalidation shows sign-in without another query read",
	[],
	function* ({ observe, ready, reads, recheckedSessions, signOut, text }) {
		yield* observe("the open page is live", () => expect(ready()).toBe(true));
		const before = reads();
		yield* signOut();
		yield* observe("the boundary shows sign-in after stream revalidation", () => expect(text()).toBe("Sign in"));
		expect(reads()).toBe(before);
		expect(recheckedSessions()).toEqual([undefined]);
	},
);

liveSessionStory.it("an ended session stops live reconnects", [], function* ({ active, lookups, observe, ready, signOut, wait }) {
	yield* observe("the open page is live", () => expect(ready()).toBe(true));
	yield* signOut();
	yield* observe("the server ends the authenticated stream", () => expect(active()).toBe(0));
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

liveSessionStory.it(
	"sign-out cancels a private refresh window and same-account re-entry owns new keys",
	[],
	function* ({ observe, ready, reads, registries, rename, signOut, signIn, text, wait }) {
		yield* observe("the private session is live", () => expect(ready()).toBe(true));
		const old = registries()[0];
		const before = reads();
		yield* rename("Pending private refresh");
		yield* wait(50);
		expect(reads()).toBe(before);
		expect(text()).toBe("First");
		yield* signOut();
		yield* observe("the session boundary discards the outgoing keys", () => {
			expect(text()).toBe("Sign in");
			expect(old?.getNodes().size).toBe(0);
		});
		yield* wait(600);
		expect(reads()).toBe(before);
		yield* signIn();
		yield* observe("the new scope reads current private data", () => {
			expect(ready()).toBe(true);
			expect(text()).toBe("Pending private refresh");
		});
		expect(registries()).toEqual([old, expect.any(Object)]);
		expect(registries()[1]).not.toBe(old);
		expect(old?.getNodes().size).toBe(0);
	},
);
