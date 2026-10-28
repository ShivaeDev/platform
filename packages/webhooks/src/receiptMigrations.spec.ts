import { Cause, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { schemaInbox } from "#test/schemaInbox.ts";

schemaInbox.it(
	"check mode reports missing receipts and starts after the component is applied",
	[],
	function* ({ installJobs, checkHost, pending, apply }) {
		yield* installJobs();
		expect(yield* pending()).toBe("webhook_receipts is missing");
		const before = yield* checkHost();
		expect(Exit.isFailure(before)).toBe(true);
		if (Exit.isFailure(before)) {
			expect(Cause.pretty(before.cause)).toContain("webhook-receipts");
		}
		yield* apply();
		expect(yield* pending()).toBeUndefined();
		expect(Exit.isSuccess(yield* checkHost())).toBe(true);
	},
);

schemaInbox.it(
	"wait mode starts the host only after the receipts component is applied",
	[],
	function* ({ installJobs, startWaitingHost, untilHostLogs, hostStarted, pending, apply }) {
		yield* installJobs();
		const host = yield* startWaitingHost();
		yield* untilHostLogs("Waiting for database migrations");
		expect(hostStarted()).toBe(false);
		expect(yield* pending()).toBe("webhook_receipts is missing");
		yield* apply();
		yield* Fiber.join(host);
		expect(hostStarted()).toBe(true);
	},
);
