import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { anotherPageOfSessions, sessionsScreen, sessionsViewOpen, sessionsViewOpenInBrowserZone, unprivilegedViewer } from "#test/sessionsScreen.tsx";

expectNoReactWarnings();

const alice = {
	current: true,
	email: "alice@app.test",
	name: "alice",
	times: [
		{ text: "1 Jan 2026, 13:00:00 CET", value: "2026-01-01T12:00:00.000Z" },
		{ text: "3 Jan 2026, 13:00:00 CET", value: "2026-01-03T12:00:00.000Z" },
		{ text: "1 Jan 2100, 13:00:00 CET", value: "2100-01-01T12:00:00.000Z" },
	],
};
const bob = {
	current: false,
	email: "bob@app.test",
	name: "bob",
	times: [
		{ text: "1 Jan 2026, 13:00:00 CET", value: "2026-01-01T12:00:00.000Z" },
		{ text: "2 Jan 2026, 13:00:00 CET", value: "2026-01-02T12:00:00.000Z" },
		{ text: "1 Jan 2100, 13:00:00 CET", value: "2100-01-01T12:00:00.000Z" },
	],
};

sessionsScreen.it(
	"lists signed-in users with started, last activity and expiry in the given locale and time zone over their UTC instants, marking only the current session",
	[sessionsViewOpen],
	function* ({ shownSessions }) {
		expect(yield* shownSessions()).toEqual([alice, bob]);
	},
);

sessionsScreen.it(
	"a sessions view given no time zone shows alice's started, last activity and expiry times in the browser's zone and keeps the UTC instants in the time elements",
	[sessionsViewOpenInBrowserZone("Asia/Tokyo")],
	function* ({ shownSessions }) {
		const [first] = yield* shownSessions();

		expect(first).toEqual({
			...alice,
			times: [
				{ text: "1 Jan 2026, 21:00:00 GMT+9", value: "2026-01-01T12:00:00.000Z" },
				{ text: "3 Jan 2026, 21:00:00 GMT+9", value: "2026-01-03T12:00:00.000Z" },
				{ text: "1 Jan 2100, 21:00:00 GMT+9", value: "2100-01-01T12:00:00.000Z" },
			],
		});
	},
);

sessionsScreen.it(
	"requesting revocation focuses the confirmation and leaves the session listed",
	[sessionsViewOpen],
	function* ({ requestRevoke, shownSessions, confirmation, confirmationFocused }) {
		yield* requestRevoke("bob");

		yield* outcomes([
			["confirmation", () => confirmation(), expect.stringContaining("End the session for bob@app.test?")],
			["focused", () => confirmationFocused(), true],
			["sessions", () => shownSessions(), [alice, bob]],
		]);
	},
);

sessionsScreen.it(
	"cancelling revocation closes the confirmation and leaves the session listed",
	[sessionsViewOpen],
	function* ({ requestRevoke, cancelRevoke, shownSessions, confirmation }) {
		yield* requestRevoke("bob");

		yield* cancelRevoke();

		yield* outcomes([
			["confirmation", () => confirmation(), "no confirmation"],
			["sessions", () => shownSessions(), [alice, bob]],
		]);
	},
);

sessionsScreen.it(
	"confirming revocation removes bob's session from the list",
	[sessionsViewOpen],
	function* ({ requestRevoke, confirmRevoke, shownSessions }) {
		expect(yield* shownSessions()).toEqual([alice, bob]);
		yield* requestRevoke("bob");

		yield* confirmRevoke();

		expect(yield* shownSessions()).toEqual([alice]);
	},
);

sessionsScreen.it(
	"revoking the current session warns the viewer and hands off to sign-out",
	[sessionsViewOpen],
	function* ({ requestRevoke, confirmRevoke, content, confirmation }) {
		yield* requestRevoke("alice");
		expect(yield* confirmation()).toContain("This signs you out.");

		yield* confirmRevoke();

		expect(yield* content()).toBe("Signed out");
	},
);

sessionsScreen.it(
	"a viewer without the sessions permission is refused without showing sessions",
	[unprivilegedViewer, sessionsViewOpen],
	function* ({ content, shownSessions }) {
		yield* outcomes([
			["content", () => content(), "Permission required to manage sessions."],
			["sessions", () => shownSessions(), []],
		]);
	},
);

sessionsScreen.it(
	"paging forward reaches bob and paging back restores the first page",
	[anotherPageOfSessions, sessionsViewOpen],
	function* ({ shownEmails, nextSessions, previousSessions }) {
		const firstPage = yield* shownEmails();
		expect(firstPage).toEqual(expect.arrayContaining(["alice@app.test", ...Array.from({ length: 19 }, (_, index) => `guest-${index}@app.test`)]));

		yield* nextSessions();

		expect(yield* shownEmails()).toEqual(["bob@app.test"]);

		yield* previousSessions();

		expect(yield* shownEmails()).toEqual(firstPage);
	},
);

sessionsScreen.it(
	"revoking the last session on a page shows the empty state and allows returning to the first page",
	[anotherPageOfSessions, sessionsViewOpen],
	function* ({ nextSessions, requestRevoke, confirmRevoke, content, previousSessions, shownEmails }) {
		yield* nextSessions();
		expect(yield* shownEmails()).toEqual(["bob@app.test"]);
		yield* requestRevoke("bob");

		yield* confirmRevoke();

		expect(yield* content()).toContain("No signed-in sessions.");

		yield* previousSessions();

		expect(yield* shownEmails()).toContain("alice@app.test");
	},
);

sessionsScreen.it(
	"a stale confirmation reports the refused revoke and refresh removes the ended session",
	[sessionsViewOpen],
	function* ({ requestRevoke, revokeElsewhere, confirmRevoke, alerts, refreshSessions, shownSessions }) {
		yield* requestRevoke("bob");
		yield* revokeElsewhere("bob");

		yield* confirmRevoke();

		expect(yield* alerts()).toContain("Could not revoke the session. Refresh and try again.");

		yield* refreshSessions();

		expect(yield* shownSessions()).toEqual([alice]);
	},
);
