import { expect } from "vitest";
import { quotaRemaining } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const seconds of [undefined, 180, 30]) {
	const period = (seconds ?? 900) * 1000;
	watch.it(
		`a quiet fleet emits heartbeats every ${seconds ?? 900} seconds across polls`,
		[],
		function* (h) {
			const args = seconds === undefined ? [] : ["--heartbeat", String(seconds)];
			yield* h.start("--interval", "60", "--events", "dequeued", ...args);
			yield* h.waitForPollWait();
			expect(h.events()).toEqual([]);
			const interval = 60_000;
			const step = Math.min(interval, period);
			for (let elapsed = step; elapsed <= period * 2; elapsed += step) {
				yield* h.advance(step);
				yield* h.waitForPollWait();
				const expected = Array.from({ length: Math.floor(elapsed / period) }, (_, index) =>
					expect.objectContaining({
						at: new Date((index + 1) * period).toISOString(),
						event: "heartbeat",
						nextPollAt: expect.any(String),
					}),
				);
				expect(h.events()).toEqual(expected);
			}
			expect(h.requests.filter((request) => request.path.endsWith("/pulls/1")).length).toBeGreaterThan(1);
			yield* h.interrupt();
			expect(h.events().at(-1)).toMatchObject({ event: "stopped", reason: "interrupted" });
		},
		{ clock: "test" },
	);
}

watch.it(
	"disabling heartbeats keeps every quiet poll silent and still reports interruption",
	[],
	function* (h) {
		yield* h.start("--interval", "60", "--heartbeat", "0", "--events", "dequeued");
		yield* h.waitForPollWait();
		const interval = 60_000;
		const halfHour = 30;
		for (let round = 0; round < halfHour; round += 1) {
			yield* h.advance(interval);
			yield* h.waitForPollWait();
			expect(h.events()).toEqual([]);
		}
		yield* h.interrupt();
		expect(h.events()).toEqual([
			expect.objectContaining({ at: new Date(halfHour * interval).toISOString(), event: "stopped", reason: "interrupted" }),
		]);
	},
	{ clock: "test" },
);

watch.it(
	"quota pacing reports its cooldown immediately and keeps the same next poll time in periodic heartbeats",
	[quotaRemaining(9)],
	function* (h) {
		yield* h.start("--interval", "60", "--events", "merged");
		yield* h.waitForPollWait();
		expect(h.events()).toEqual([expect.objectContaining({ at: new Date(0).toISOString(), event: "cooldown", nextPollAt: expect.any(String) })]);
		const cooldown = h.events()[0];
		const halfHour = 30 * 60 * 1000;
		expect(cooldown.delayMs).toBeGreaterThanOrEqual(halfHour);
		const requests = [...h.requests];
		const period = 900_000;
		yield* h.advance(period - 1);
		expect(h.eventNames()).toEqual(["cooldown"]);
		yield* h.advance(1);
		expect(h.events()).toEqual([
			cooldown,
			expect.objectContaining({ at: new Date(period).toISOString(), event: "heartbeat", nextPollAt: cooldown.nextPollAt }),
		]);
		expect(h.requests).toEqual(requests);
		yield* h.interrupt();
	},
	{ clock: "test" },
);

watch.it(
	"a printed PR transition restarts the quiet heartbeat period",
	[],
	function* (h) {
		yield* h.start("--interval", "60", "--heartbeat", "180");
		yield* h.waitForPollWait();
		const interval = 60_000;
		yield* h.advance(interval);
		yield* h.waitForPollWait();
		h.merged(1);
		yield* h.advance(interval);
		yield* h.waitForPollWait();
		expect(h.eventNames()).toEqual(["merged"]);
		const quietPolls = 2;
		for (let round = 0; round < quietPolls; round += 1) {
			yield* h.advance(interval);
			yield* h.waitForPollWait();
			expect(h.eventNames()).toEqual(["merged"]);
		}
		yield* h.advance(interval);
		yield* h.waitForPollWait();
		const due = 300_000;
		expect(h.events().at(-1)).toMatchObject({ at: new Date(due).toISOString(), event: "heartbeat" });
		yield* h.interrupt();
	},
	{ clock: "test" },
);

watch.it(
	"disabling heartbeats still prints a quota pacing cooldown immediately",
	[quotaRemaining(9)],
	function* (h) {
		yield* h.start("--interval", "60", "--heartbeat", "0");
		yield* h.waitForPollWait();
		expect(h.events()).toEqual([expect.objectContaining({ at: new Date(0).toISOString(), event: "cooldown", nextPollAt: expect.any(String) })]);
		const requests = [...h.requests];
		const period = 900_000;
		yield* h.advance(period);
		expect(h.eventNames()).toEqual(["cooldown"]);
		expect(h.requests).toEqual(requests);
		yield* h.interrupt();
		expect(h.eventNames()).toEqual(["cooldown", "stopped"]);
	},
	{ clock: "test" },
);
