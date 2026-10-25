import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { watch } from "#test/watch.ts";

watch.it("the command honors exhausted quota until reset without making another request", [], function* (test) {
	const now = yield* Clock.currentTimeMillis;
	const reset = Math.ceil(now / 1000) + 3600;
	test.reply("/commits/sha1/status", {
		body: { state: "success" },
		headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset) },
	});
	yield* test.once();
	const delay = yield* test.delay();
	expect(delay).toBeGreaterThan(reset * 1000 - now - 1000);
	const requests = [...test.requests];
	expect((yield* Effect.result(test.once()))._tag).toBe("Failure");
	expect(test.requests).toEqual(requests);
});

watch.it("the command backs off forbidden responses without making another request", [], function* (test) {
	test.reply("/commits/sha1/status", { body: {}, status: 403 });
	expect((yield* Effect.result(test.once()))._tag).toBe("Failure");
	const fallback = 60_000;
	expect(yield* test.delay()).toBeGreaterThan(fallback - 1000);
	const requests = [...test.requests];
	expect((yield* Effect.result(test.once()))._tag).toBe("Failure");
	expect(test.requests).toEqual(requests);
});

watch.it("the command paces HTTP-date retry-after responses", [], function* (test) {
	const retryAt = new Date((yield* Clock.currentTimeMillis) + 120_000);
	test.reply("/commits/sha1/status", { body: {}, headers: { "retry-after": retryAt.toUTCString() }, status: 429 });
	expect((yield* Effect.result(test.once()))._tag).toBe("Failure");
	const delay = yield* test.delay();
	expect(delay).toBeGreaterThan(retryAt.getTime() - (yield* Clock.currentTimeMillis) - 1000);
	const requests = [...test.requests];
	expect((yield* Effect.result(test.once()))._tag).toBe("Failure");
	expect(test.requests).toEqual(requests);
});
