import { expect } from "@effect/vitest";
import { ciCapacity } from "#test/ciCapacity.ts";

ciCapacity.it("the provider-default Cloud launch omits the tier from both requests and accepts an absent echo", [], function* (daemon) {
	daemon.queuedRuns(5);
	yield* daemon.intervalPasses();

	yield* daemon.dispatch("one");

	const record = yield* daemon.record("one");
	expect(record.attempts).toMatchObject([{ receipt: { sessionId: "session-1", turnId: "turn-1" }, settings: {}, status: "accepted" }]);
	expect(record.attempts[0]?.settings).not.toHaveProperty("serviceTier");
	for (const method of ["thread/start", "turn/start"]) {
		expect(daemon.sent(method)).toEqual([expect.not.objectContaining({ serviceTier: expect.anything() })]);
		expect(daemon.sent(method)[0]).not.toHaveProperty("serviceTier");
	}
	expect((yield* daemon.cliStatus()).stdout).toContain("Service tier provider default: 5 queued CI runs; provider default at >= 5, fast at <= 2");
});

ciCapacity.it("the fast Cloud launch requests fast on its thread and turn", [], function* (daemon) {
	yield* daemon.dispatch("one");

	expect((yield* daemon.record("one")).attempts).toMatchObject([
		{ receipt: { turnId: "turn-1" }, settings: { serviceTier: "fast" }, status: "accepted" },
	]);
	for (const method of ["thread/start", "turn/start"]) {
		expect(daemon.sent(method)).toMatchObject([{ serviceTier: "fast" }]);
	}
});

ciCapacity.it("work rejected for the literal default tier starts when dispatched again with CI capacity", [], function* (daemon) {
	yield* daemon.launchSetting({ serviceTier: "default" });
	yield* daemon.dispatch("one");
	const rejected = yield* daemon.record("one");
	expect(rejected).toMatchObject({ decision: { code: "session-rejected", reason: expect.stringContaining("invalid service tier: default") } });
	expect(rejected.attempts).toMatchObject([{ settings: { serviceTier: "default" }, status: "failed" }]);
	expect(daemon.sent("turn/start")).toEqual([]);
	daemon.queuedRuns(5);
	yield* daemon.launchSetting({ serviceTier: { ciCapacity: { fastAt: 2, slowAt: 5 } } });
	yield* daemon.intervalPasses();

	yield* daemon.dispatch("one");

	const retried = yield* daemon.record("one");
	expect(retried.decision).toBeUndefined();
	expect(retried.attempts).toMatchObject([
		{ settings: { serviceTier: "default" }, status: "failed" },
		{ receipt: { turnId: "turn-1" }, settings: {}, status: "accepted" },
	]);
	expect(retried.attempts[1]?.settings).not.toHaveProperty("serviceTier");
	expect(daemon.sent("thread/start")).toMatchObject([{ serviceTier: "default" }, expect.not.objectContaining({ serviceTier: expect.anything() })]);
	expect(daemon.sent("thread/start")[1]).not.toHaveProperty("serviceTier");
	expect(daemon.sent("turn/start")[0]).not.toHaveProperty("serviceTier");
});

ciCapacity.it("a repair switches an existing fast Cloud session to the provider default without sending a tier", [], function* (daemon) {
	yield* daemon.dispatch("one");
	daemon.complete();
	yield* daemon.reconcile("one");
	daemon.queuedRuns(5);
	yield* daemon.intervalPasses();

	const repaired = yield* daemon.repair("one");

	expect(repaired.value.attempts.at(-1)).toMatchObject({
		receipt: { sessionId: "session-1", turnId: "turn-2" },
		role: "repair",
		settings: {},
		status: "accepted",
	});
	expect(repaired.value.attempts.at(-1)?.settings).not.toHaveProperty("serviceTier");
	expect(daemon.sent("thread/start")).toMatchObject([{ serviceTier: "fast" }]);
	expect(daemon.sent("turn/start")).toMatchObject([{ serviceTier: "fast" }, expect.not.objectContaining({ serviceTier: expect.anything() })]);
	expect(daemon.sent("turn/start")[1]).not.toHaveProperty("serviceTier");
});
