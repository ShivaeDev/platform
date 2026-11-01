import { expect } from "vitest";
import { transport } from "#test/transport.ts";

transport.it("interrupting Mailer aborts its in-flight Resend request", [], function* ({ beginSend, cancelSend, abandonedRequest }) {
	yield* beginSend();

	yield* cancelSend();

	expect(yield* abandonedRequest()).toBe("/emails");
});
