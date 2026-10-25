import { Clock, Effect } from "effect";
import { assert, expect } from "vitest";
import { quotaRemaining } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it("quota headers slow down polling and honor retry-after without further requests", [quotaRemaining(5000)], function* (h) {
	yield* h.poll;
	expect(yield* h.delay()).toBe(h.options.interval);
	yield* h.quotaRemaining(400);
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
		body: { state: "success" },
		headers: { "x-ratelimit-limit": "5000", "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset), "x-ratelimit-used": "5000" },
	});
	yield* h.once();
	expect(yield* h.delay()).toBeGreaterThan(reset * 1000 - now - 1000);
	const requests = [...h.requests];
	expect((yield* Effect.result(h.once()))._tag).toBe("Failure");
	expect(h.requests).toEqual(requests);
});
watch.it("a permission failure retains the snapshot and allows the next scheduled poll", [], function* (h) {
	yield* h.poll;
	h.reply("/commits/sha1/status", { body: {}, status: 403 });
	expect((yield* Effect.result(h.once()))._tag).toBe("Failure");
	expect(h.lines).toEqual([]);
	h.statusIs(1, "success");
	yield* h.poll;
	expect(h.lines).toEqual([]);
});
watch.it("an HTTP-date retry instant defers polling without events or further requests", [], function* (h) {
	const retryAt = new Date((yield* Clock.currentTimeMillis) + 120_000);
	h.reply("/commits/sha1/status", { body: {}, headers: { "retry-after": retryAt.toUTCString() }, status: 429 });
	expect((yield* Effect.result(h.once()))._tag).toBe("Failure");
	expect(yield* h.delay()).toBeGreaterThan(retryAt.getTime() - (yield* Clock.currentTimeMillis) - 1000);
	const requests = [...h.requests];
	expect((yield* Effect.result(h.once()))._tag).toBe("Failure");
	expect(h.requests).toEqual(requests);
	expect(h.lines).toEqual([]);
});

watch.it("continuous polling emits nothing during a rate limit and resumes at retryAt", [], function* (h) {
	yield* h.poll;
	h.pullIs(1, { mergeable: false, "mergeable_state": "dirty" });
	h.throttled(2);
	yield* h.start();
	yield* h.waitForDiagnostic();
	const requests = [...h.requests];
	const limited = requests.at(-1);
	assert.isDefined(limited);
	const retryAt = limited.at + 2000;
	expect(h.lines).toEqual([]);
	h.statusIs(1, "success");
	expect(yield* h.requestsAfterPause()).toEqual(requests);
	yield* h.waitForEvents(2);
	yield* h.interrupt();
	expect(h.requests[requests.length]?.at).toBeGreaterThanOrEqual(retryAt);
	expect(h.eventNames()).toEqual(["conflict", "stuck"]);
});
