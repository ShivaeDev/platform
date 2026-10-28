import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { hasPull } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it(
	"a failed poll retries from saved history and reports a later filtered closure",
	[],
	function* (h) {
		yield* h.poll;
		h.reply("/pulls/1", { body: {}, status: HttpStatus.fromLiteral("ServiceUnavailable") });
		yield* h.start("--interval", "60", "--heartbeat", "1500", "--events", "dequeued,stuck,conflict,auto-merge-off,closed");
		yield* h.waitForPollWait();
		expect(h.events()[0]).toMatchObject({ event: "error", message: expect.stringContaining("HTTP 503") });
		expect(h.eventNames()).not.toContain("stopped");
		expect((yield* h.stored()).prs["1"].merged).toBe(false);
		h.pullIs(1, { state: "closed" });
		yield* h.advance(60_000);
		yield* h.waitForEvents(1);
		expect(h.transitions()).toEqual([{ branch: "feature-1", event: "closed", number: 1, title: "Change 1" }]);
		yield* h.interrupt();
	},
	{ clock: "test" },
);

watch.it(
	"a transport error names the network cause and the next poll can discover work",
	[],
	function* (h) {
		h.transportFails();
		yield* h.start("--heartbeat", "0");
		yield* h.waitForPollWait();
		expect(h.events()[0]).toMatchObject({ event: "error", message: expect.stringContaining("network error") });
		h.transportFails(false);
		h.merged(1);
		yield* h.advance(1000);
		yield* h.waitForEvents(1);
		expect(h.transitions()[0]).toMatchObject({ event: "merged", number: 1 });
		yield* h.interrupt();
	},
	{ clock: "test" },
);

for (const status of [HttpStatus.fromLiteral("Unauthorized"), HttpStatus.fromLiteral("Forbidden"), HttpStatus.fromLiteral("NotFound")]) {
	watch.it(`HTTP ${status} stops the continuous watcher with its cause`, [], function* (h) {
		h.reply("/pulls/1", { body: {}, status });
		yield* h.start();
		const exit = yield* h.finish();
		expect(exit._tag).toBe("Failure");
		expect(h.eventNames()).toEqual(["error", "stopped"]);
		expect(h.events()[0]).toMatchObject({ message: expect.stringContaining(`HTTP ${status}`) });
		expect(h.events()[1]).toMatchObject({ reason: "failed" });
	});
}

watch.it("a permanent failure is not masked by another PR's transient failure", [hasPull(2)], function* (h) {
	h.openPulls(1, 2);
	h.reply("/pulls/1", { body: {}, status: HttpStatus.fromLiteral("Unauthorized") });
	h.reply("/pulls/2", { body: {}, status: HttpStatus.fromLiteral("ServiceUnavailable") });
	yield* h.start();
	expect((yield* h.finish())._tag).toBe("Failure");
	expect(h.eventNames()).toEqual(["error", "error", "stopped"]);
	expect(h.events()[0].message).toContain("HTTP 401");
	expect(h.events()[1].message).toContain("HTTP 503");
});

watch.it(
	"a timed out request reports its cause and retries the next poll",
	[],
	function* (h) {
		h.transportStalls();
		yield* h.start("--heartbeat", "0");
		yield* h.waitForTransport();
		yield* h.advance(30_000);
		yield* h.waitForPollWait();
		expect(h.events()[0]).toMatchObject({ event: "error", message: "GitHub request timed out after 30 seconds" });
		h.transportStalls(false);
		h.merged(1);
		yield* h.advance(1000);
		yield* h.waitForEvents(1);
		expect(h.transitions()[0]).toMatchObject({ event: "merged", number: 1 });
		yield* h.interrupt();
	},
	{ clock: "test" },
);

for (const status of [HttpStatus.fromLiteral("Forbidden"), HttpStatus.fromLiteral("ServiceUnavailable")]) {
	watch.it(
		`HTTP ${status} with Retry-After waits before retrying and observing a merge`,
		[],
		function* (h) {
			yield* h.poll;
			h.reply("/pulls/1", { body: {}, headers: { "retry-after": "2" }, status });
			yield* h.start("--heartbeat", "0");
			yield* h.waitForPollWait();
			expect(h.eventNames()).toEqual(["error", "cooldown"]);
			expect(h.events()[0].message).toContain(status === HttpStatus.fromLiteral("Forbidden") ? "rate limit" : "HTTP 503");
			expect(h.events()[1]).toMatchObject({ delayMs: 2000, nextPollAt: new Date(2000).toISOString() });
			const requests = [...h.requests];
			h.merged(1);
			yield* h.advance(1999);
			expect(h.requests).toEqual(requests);
			yield* h.advance(1);
			yield* h.waitForEvents(1);
			expect(h.transitions()[0]).toMatchObject({ event: "merged", number: 1 });
			yield* h.interrupt();
		},
		{ clock: "test" },
	);
}
