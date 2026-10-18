import { expect } from "@effect/vitest";
import { lostAcknowledgement, publishedWork, recoveryFleet } from "#test/recoveryFleet.ts";
import { WORK_BRANCH, WORK_PR } from "#test/workPublication.ts";

for (const published of ["branch", "pr"] as const) {
	for (const rejection of ["session", "turn"] as const) {
		recoveryFleet.it(
			`a receiptless ${published} repair retries a capacity-rejected replacement ${rejection} after restart`,
			[lostAcknowledgement(), publishedWork(published)],
			function* ({ fleet, provider, fixture, setTime }) {
				yield* fleet.prepare();
				const original = (yield* fleet.dispatch()).value.attempts.at(-1);
				expect(original?.receipt).toBeUndefined();
				provider.lose(original?.sessionId);
				provider.rejectNext(rejection);
				const rejected = (yield* fleet.reconcile()).value;
				expect(rejected.stage).toBe("repairing");
				expect(rejected.decision).toBeUndefined();
				expect(rejected.launchRetry).toMatchObject({ rejections: 1, retryAt: 30_100 });
				expect(rejected.attempts.at(-1)).toMatchObject({ output: "Replacement capacity unavailable", role: "repair", status: "failed" });
				expect(rejected.attempts.at(-1)?.sessionUnusable).toBeUndefined();
				yield* fleet.restart();
				setTime(30_099);
				yield* fleet.cycle();
				expect((yield* fleet.get()).value.attempts).toHaveLength(2);
				setTime(30_100);
				yield* fleet.cycle();
				const resumed = (yield* fleet.get()).value;
				expect(resumed.stage).toBe("executing");
				expect(resumed.launchRetry).toBeUndefined();
				expect(resumed.decision).toBeUndefined();
				expect(resumed.attempts).toHaveLength(3);
				expect(resumed.attempts.at(-1)).toMatchObject({ role: "repair", status: "accepted" });
				expect(resumed.attempts.at(-1)?.receipt).toBeDefined();
				expect(resumed.attempts.at(-1)?.sessionId).not.toBe(original?.sessionId);
				expect(resumed.attempts.at(-1)?.prompt).toContain(WORK_BRANCH);
				if (published === "pr") {
					expect(resumed.attempts.at(-1)?.prompt).toContain(WORK_PR);
				}
				yield* fleet.cycle();
				expect((yield* fleet.get()).value.attempts.at(-1)?.status).toBe("running");
				expect(fixture.decisions).toEqual([]);
			},
		);
	}
}
