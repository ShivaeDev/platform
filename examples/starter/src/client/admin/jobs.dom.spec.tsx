import { expect } from "vitest";
import { foundationJobsOpen, foundationJobsScreen } from "#test-support/admin/foundationJobsScreen.tsx";

foundationJobsScreen.it(
	"Jobs administration offers the auth-email and session-sweep queues",
	[foundationJobsOpen],
	function* ({ queueFilter, settle }) {
		yield* settle();

		expect(yield* queueFilter()).toEqual(expect.arrayContaining(["identity.auth-emails", "sweep-expired-auth-sessions"]));
	},
);
