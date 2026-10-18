import { Clock, DateTime } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import { clockApp } from "#test/clockApp.ts";

clockApp.it(
	"pins the host, queued worker and screen to one UTC instant and advances them together",
	[],
	function* ({ click, settle, text, hostReadout }) {
		yield* click("button");
		yield* settle();
		expect(text("#host")).toBe("Host: Oct 17");
		expect(text("#worker")).toBe("Worker: since Oct 17");
		expect(text("#screen")).toBe("Screen: Oct 17");
		expect(yield* hostReadout()).toEqual({
			createdAt: DateTime.toEpochMillis(DateTime.makeUnsafe("2026-10-17T12:34:56.000Z")),
			hostAt: "2026-10-17T12:34:56.000Z",
			workerAt: "2026-10-17T12:34:56.000Z",
		});
		yield* TestClock.adjust("1 day");
		yield* click("button");
		yield* settle();
		expect(text("#host")).toBe("Host: Oct 18");
		expect(text("#worker")).toBe("Worker: since Oct 18");
		expect(text("#screen")).toBe("Screen: Oct 18");
		expect(yield* hostReadout()).toMatchObject({ hostAt: "2026-10-18T12:34:56.000Z", workerAt: "2026-10-18T12:34:56.000Z" });
	},
	{ clock: DateTime.makeUnsafe("2026-10-17T12:34:56.000Z") },
);

clockApp.it("uses real time when the story does not pin the clock", [], function* ({ click, settle, text, hostReadout }) {
	const before = yield* Clock.currentTimeMillis;
	yield* click("button");
	yield* settle();
	const readout = yield* hostReadout();
	const after = yield* Clock.currentTimeMillis;
	expect(before).toBeGreaterThan(1_000_000_000_000);
	for (const instant of [readout.hostAt, readout.workerAt]) {
		expect(DateTime.toEpochMillis(DateTime.makeUnsafe(instant))).toBeGreaterThanOrEqual(before);
		expect(DateTime.toEpochMillis(DateTime.makeUnsafe(instant))).toBeLessThanOrEqual(after);
	}
	function day(instant: string | number) {
		return DateTime.formatUtc(DateTime.makeUnsafe(instant), { day: "numeric", locale: "en-US", month: "short" });
	}
	expect([`Host: ${day(before)}`, `Host: ${day(after)}`]).toContain(text("#host"));
	expect(text("#worker")).toBe(`Worker: since ${day(readout.workerAt)}`);
	expect([`Screen: ${day(before)}`, `Screen: ${day(after)}`]).toContain(text("#screen"));
});
