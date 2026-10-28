import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { hasPull, watchesPulls } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it(
	"partial round successes stay acknowledged when another PR needs a retry",
	[hasPull(2), watchesPulls(1, 2)],
	function* (h) {
		h.openPulls(1, 2);
		yield* h.poll;
		h.merged(1);
		h.reply("/pulls/2", { body: {}, status: HttpStatus.fromLiteral("InternalServerError") });
		yield* h.start("--heartbeat", "0");
		yield* h.waitForPollWait();
		expect((yield* h.stored()).prs["1"].merged).toBe(true);
		h.merged(2);
		yield* h.advance(1000);
		yield* h.waitForEvents(2);
		yield* h.waitForPollWait();
		expect(h.transitions().map((event) => [event.event, event.number])).toEqual([
			["merged", 1],
			["merged", 2],
		]);
		yield* h.interrupt();
	},
	{ clock: "test" },
);

watch.it(
	"a successful round resets retry backoff before another failure",
	[],
	function* (h) {
		h.reply("/pulls/1", { body: {}, status: HttpStatus.fromLiteral("InternalServerError") });
		yield* h.start("--heartbeat", "0");
		yield* h.waitForPollWait();
		yield* h.advance(1000);
		yield* h.waitForPollWait();
		expect(h.events().at(-1)).toMatchObject({ delayMs: 2000, event: "cooldown" });
		h.pullIs(1);
		yield* h.advance(2000);
		yield* h.waitForPollWait();
		h.reply("/pulls/1", { body: {}, status: HttpStatus.fromLiteral("InternalServerError") });
		yield* h.advance(1000);
		yield* h.waitForPollWait();
		expect(h.events().at(-1)).toMatchObject({ event: "error" });
		h.merged(1);
		yield* h.advance(1000);
		yield* h.waitForEvents(1);
		expect(h.transitions()[0]).toMatchObject({ event: "merged", number: 1 });
		yield* h.interrupt();
	},
	{ clock: "test" },
);

watch.it(
	"heartbeats continue through a retry cooldown that is bounded by the outage deadline",
	[],
	function* (h) {
		h.throttled(7200);
		yield* h.start("--heartbeat", "1500");
		yield* h.waitForPollWait();
		const hour = 3_600_000;
		expect(h.events()[1]).toMatchObject({ delayMs: hour, event: "cooldown", nextPollAt: new Date(hour).toISOString() });
		const requests = [...h.requests];
		yield* h.advance(1_500_000);
		expect(h.events().at(-1)).toMatchObject({ event: "heartbeat", nextPollAt: new Date(hour).toISOString() });
		yield* h.advance(2_100_000);
		expect((yield* h.finish())._tag).toBe("Failure");
		expect(h.requests).toEqual(requests);
		expect(h.events().at(-1)).toMatchObject({ event: "stopped", reason: "failed" });
	},
	{ clock: "test" },
);

watch.it(
	"backoff grows to five minutes and a continuous outage stops after one hour",
	[],
	function* (h) {
		h.reply("/pulls/1", { body: {}, status: HttpStatus.fromLiteral("BadGateway") });
		yield* h.start("--heartbeat", "0");
		yield* h.waitForPollWait();
		expect(h.eventNames()).toEqual(["error"]);
		const initialWaits = [1000, 2000, 4000, 8000, 16_000, 32_000, 64_000, 128_000, 256_000];
		let elapsed = 0;
		for (const delay of initialWaits) {
			yield* h.advance(delay);
			elapsed += delay;
			yield* h.waitForPollWait();
			const cooldown = h.events().at(-1);
			expect(cooldown).toMatchObject({ delayMs: Math.min(delay * 2, 300_000), event: "cooldown" });
		}
		const hour = 3_600_000;
		while (elapsed < hour) {
			const remaining = hour - elapsed;
			const delay = Math.min(300_000, remaining);
			expect(h.events().at(-1)).toMatchObject({ delayMs: delay, nextPollAt: new Date(elapsed + delay).toISOString() });
			yield* h.advance(delay);
			elapsed += delay;
			if (elapsed < hour) {
				yield* h.waitForPollWait();
			}
		}
		expect((yield* h.finish())._tag).toBe("Failure");
		expect(h.events().slice(-2)).toEqual([
			expect.objectContaining({
				at: new Date(hour).toISOString(),
				event: "error",
				message: expect.stringMatching(/outage exceeded 1 hour:.*HTTP 502/u),
			}),
			expect.objectContaining({ event: "stopped", reason: "failed" }),
		]);
		expect(h.transitions()).toEqual([]);
	},
	{ clock: "test" },
);
