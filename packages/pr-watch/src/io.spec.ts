import { Effect } from "effect";
import { expect } from "vitest";
import { githubReplies, watchesFleet } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it("injected FileSystem and HttpClient own the synthetic-server observation and durable state", [], function* (h) {
	yield* h.poll;
	h.merged(1);
	yield* h.poll;
	expect(h.io.reads).toEqual([h.options.stateFile, h.options.stateFile]);
	expect(h.io.replacements).toEqual([h.options.stateFile, h.options.stateFile]);
	expect(h.io.urls).toHaveLength(h.requests.length);
	expect(h.io.urls.every((url) => url.startsWith(h.options.apiUrl))).toBe(true);
	expect((yield* h.stored()).prs["1"].merged).toBe(true);
	expect(yield* h.stateMode()).toBe(0o600);
});
watch.it("graceful interruption waits for discovered open numbers to reach the state file", [watchesFleet()], function* (h) {
	yield* h.interruptPollAt("replacement");
	expect(yield* h.stored()).toMatchObject({ openNumbers: [1], prs: {} });
	h.merged(1);
	h.openPulls();
	yield* h.restart;
	yield* h.restart;
	expect(h.eventNames()).toEqual(["merged"]);
});
for (const operation of ["read", "write", "rename"] as const) {
	watch.it(`native ${operation} failures stay typed and preserve the last saved snapshot`, [], function* (h) {
		yield* h.poll;
		h.merged(1);
		h.fileOperationFails(operation);
		const result = yield* Effect.result(h.poll);
		expect(result._tag).toBe("Failure");
		if (result._tag === "Failure") {
			expect(result.failure._tag).toBe("WatchError");
		}
		expect((yield* h.stored()).prs["1"].merged).toBe(false);
	});
}
watch.it("native HTTP transport failures stay typed without inferring any transition", [], function* (h) {
	yield* h.poll;
	h.merged(1);
	const count = h.requests.length;
	h.transportFails();
	const result = yield* Effect.result(h.poll);
	expect(result._tag).toBe("Failure");
	if (result._tag === "Failure") {
		expect(result.failure._tag).toBe("WatchError");
	}
	expect(h.requests).toHaveLength(count);
	expect(h.events()).toEqual([]);
});
watch.it(
	"redirect responses are refused before sending credentials to another endpoint",
	[githubReplies("/pulls/1", { body: {}, headers: { location: "/redirected" }, status: 302 })],
	function* (h) {
		const result = yield* Effect.result(h.poll);
		expect(result._tag).toBe("Failure");
		expect(h.requests.some((request) => request.path === "/redirected")).toBe(false);
		expect(h.events()).toEqual([]);
	},
);
