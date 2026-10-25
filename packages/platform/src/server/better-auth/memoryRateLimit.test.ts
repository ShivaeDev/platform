import { expect } from "vitest";
import { atCapacity, buckets } from "#test/better-auth/memoryRateLimit.ts";

buckets.it("rolls the window forward only on allowed requests and reports retry seconds", [], function* ({ advance, consume }) {
	expect(yield* consume("alice")).toEqual({ allowed: true, retryAfter: null });
	yield* advance("9 seconds");
	expect(yield* consume("alice")).toEqual({ allowed: true, retryAfter: null });
	yield* advance("8500 millis");
	expect(yield* consume("alice")).toEqual({ allowed: false, retryAfter: 2 });
	yield* advance("500 millis");
	expect(yield* consume("alice")).toEqual({ allowed: false, retryAfter: 1 });
	yield* advance("1 second");
	expect(yield* consume("alice")).toEqual({ allowed: true, retryAfter: null });
});

buckets.it("expires buckets before applying a longer rule and keeps client counts separate", [], function* ({ advance, consume }) {
	expect(yield* consume("alice", { max: 1, window: 1 })).toEqual({ allowed: true, retryAfter: null });
	expect(yield* consume("alice", { max: 1, window: 1 })).toEqual({ allowed: false, retryAfter: 1 });
	expect(yield* consume("bob", { max: 1, window: 1 })).toEqual({ allowed: true, retryAfter: null });
	yield* advance("1 second");
	expect(yield* consume("alice", { max: 1, window: 60 })).toEqual({ allowed: true, retryAfter: null });
	expect(yield* consume("alice", { max: 2, window: 60 })).toEqual({ allowed: true, retryAfter: null });
	expect(yield* consume("alice", { max: 2, window: 60 })).toEqual({ allowed: false, retryAfter: 60 });
});

buckets.it("releases retained buckets when the mount scope closes", [], function* ({ close, consume }) {
	expect(yield* consume("alice", { max: 1, window: 60 })).toEqual({ allowed: true, retryAfter: null });
	expect(yield* consume("alice", { max: 1, window: 60 })).toEqual({ allowed: false, retryAfter: 60 });
	yield* close();
	expect(yield* consume("alice", { max: 1, window: 60 })).toEqual({ allowed: true, retryAfter: null });
});

buckets.it("evicts the oldest bucket above 100,000 entries", [atCapacity], function* ({ consume }) {
	expect(yield* consume("client-99999", { max: 1, window: 60 })).toEqual({ allowed: false, retryAfter: 60 });
	expect(yield* consume("another-client", { max: 1, window: 60 })).toEqual({ allowed: true, retryAfter: null });
	expect(yield* consume("client-0", { max: 1, window: 60 })).toEqual({ allowed: true, retryAfter: null });
	expect(yield* consume("client-99999", { max: 1, window: 60 })).toEqual({ allowed: false, retryAfter: 60 });
});
