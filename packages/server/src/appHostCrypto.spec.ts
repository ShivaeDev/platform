import { expect } from "vitest";
import { inviteCommand } from "#test/app-host/inviteCommand.ts";
import { host } from "#test/app-host/story.ts";

host.it("each invite command draws a fresh 16-digit hex code from Crypto in its handler", [inviteCommand], function* ({ createInvite }) {
	const first = yield* createInvite();
	const second = yield* createInvite();

	expect([first.code, second.code]).toEqual([expect.stringMatching(/^[0-9a-f]{16}$/u), expect.not.stringMatching(first.code)]);
});

host.it("every invite carries the one 32-digit hex issuer drawn from Crypto at startup", [inviteCommand], function* ({ createInvite }) {
	const first = yield* createInvite();
	const second = yield* createInvite();

	expect([first.issuer, second.issuer]).toEqual([expect.stringMatching(/^[0-9a-f]{32}$/u), first.issuer]);
});
