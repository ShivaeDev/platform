import { Cause, Exit } from "effect";
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
