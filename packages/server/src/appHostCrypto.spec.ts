import { expect } from "vitest";
import { inviteCommand } from "#test/app-host/inviteCommand.ts";
import { host } from "#test/app-host/story.ts";

host.it("commands generate secure invite codes with Crypto available at startup and in handlers", [inviteCommand], function* ({ createInvite }) {
	const first = yield* createInvite();
	const second = yield* createInvite();
	expect(first.code).toMatch(/^[0-9a-f]{16}$/u);
	expect(first.issuer).toMatch(/^[0-9a-f]{32}$/u);
	expect(second.issuer).toBe(first.issuer);
	expect(second.code).not.toBe(first.code);
});
