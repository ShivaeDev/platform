import { Clock, Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { quotaRemaining } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it("quota headers slow down polling and honor retry-after without further requests", [quotaRemaining(5000)], function* (h) {
	yield* h.poll;
	expect(yield* h.delay()).toBe(h.options.interval);
	yield* h.quotaRemaining(9);
	yield* h.poll;
	expect(yield* h.delay()).toBeGreaterThanOrEqual(600_000);
	h.throttled(900);
	yield* Effect.result(h.poll);
	expect(yield* h.delay()).toBeGreaterThan(890_000);
	const count = h.requests.length;
	yield* Effect.result(h.poll);
	expect(h.requests).toHaveLength(count);
	expect(h.lines).toEqual([]);
});

watch.it("exhausted quota defers polling until reset without making another request", [], function* (h) {
	const now = yield* Clock.currentTimeMillis;
	const reset = Math.ceil(now / 1000) + 3600;
	h.reply("/commits/sha1/status", {
		body: { state: "success", statuses: [] },
		headers: { "x-ratelimit-limit": "5000", "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset), "x-ratelimit-used": "5000" },
	});
	yield* h.once();
	expect(yield* h.delay()).toBeGreaterThan(reset * 1000 - now - 1000);
	const requests = [...h.requests];
	expect((yield* Effect.result(h.once()))._tag).toBe("Failure");
	expect(h.requests).toEqual(requests);
	expect(h.events().filter((event) => event.event === "cooldown")).toEqual([
		expect.objectContaining({ message: `GitHub quota cooldown (core: 0/5000 remaining; reset ${new Date(reset * 1000).toISOString()})` }),
	]);
});
watch.it("a permission failure retains the snapshot for a later invocation", [], function* (h) {
	yield* h.poll;
	h.reply("/commits/sha1/status", { body: {}, status: HttpStatus.fromLiteral("Forbidden") });
	expect((yield* Effect.result(h.once()))._tag).toBe("Failure");
	expect(h.eventNames()).toEqual(["error", "stopped"]);
	h.statusIs(1, "success");
	yield* h.poll;
	expect(h.transitions()).toEqual([]);
});
for (const status of [HttpStatus.fromLiteral("TooManyRequests"), HttpStatus.fromLiteral("ServiceUnavailable")]) {
	watch.it(`an HTTP ${status} retry instant prevents further requests without inferring transitions`, [], function* (h) {
		const retryAt = new Date((yield* Clock.currentTimeMillis) + 120_000);
		h.reply("/commits/sha1/status", { body: {}, headers: { "retry-after": retryAt.toUTCString() }, status });
		expect((yield* Effect.result(h.once()))._tag).toBe("Failure");
		expect(yield* h.delay()).toBeGreaterThan(retryAt.getTime() - (yield* Clock.currentTimeMillis) - 1000);
		const requests = [...h.requests];
		expect((yield* Effect.result(h.once()))._tag).toBe("Failure");
		expect(h.requests).toEqual(requests);
		expect(h.transitions()).toEqual([]);
	});
}

watch.it("continuous polling waits visibly on a rate limit without more requests", [], function* (h) {
	yield* h.poll;
	h.throttled(900);
	yield* h.start("--events", "dequeued");
	yield* h.waitForPollWait();
	const requests = [...h.requests];
	expect(h.eventNames()).toEqual(["error", "cooldown"]);
	expect(yield* h.requestsAfterPause()).toEqual(requests);
	expect(h.events()[1]).toMatchObject({ nextPollAt: expect.any(String) });
	yield* h.interrupt();
});
