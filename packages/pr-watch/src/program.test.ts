import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { githubReplies } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it("one long-running process discovers a later PR and stops on interruption", [], function* (h) {
	yield* h.start();
	yield* h.waitForRequest("/status");
	h.pullIs(2);
	h.openPulls(1, 2);
	yield* h.waitForRequest("sha2/status");
	h.merged(2);
	yield* h.waitForEvents(1);
	expect(h.transitions()[0]).toMatchObject({ event: "merged", number: 2 });
	yield* h.interrupt();
	const requests = [...h.requests];
	expect(yield* h.requestsAfterPause()).toEqual(requests);
});
watch.it(
	"once fails on request failure and help prints the CLI usage",
	[githubReplies("/pulls/1", { body: {}, status: HttpStatus.fromLiteral("InternalServerError") })],
	function* (h) {
		expect((yield* Effect.result(h.once()))._tag).toBe("Failure");
		expect(h.events().map((event) => event.event)).toEqual(["error", "stopped"]);
		yield* h.help();
		expect(h.lines.at(-1)).toContain("pr-watch --repo OWNER/REPO");
	},
);
watch.it(
	"a failed initial fleet snapshot retains the discovered PR across a restart",
	[githubReplies("/pulls/1", { body: {}, status: HttpStatus.fromLiteral("InternalServerError") })],
	function* (h) {
		yield* h.start();
		yield* h.waitForPollWait();
		yield* h.interrupt();
		expect(h.eventNames()).toEqual(["error", "stopped"]);
		h.merged(1);
		h.openPulls();
		yield* h.restart;
		expect(h.transitions()).toEqual([{ branch: "feature-1", event: "merged", number: 1, title: "Change 1" }]);
	},
);
watch.it("graceful interruption waits for output and snapshot replacement", [], function* (h) {
	yield* h.poll;
	h.merged(1);
	yield* h.interruptPollAt("output");
	yield* h.restart;
	expect(h.events()).toHaveLength(1);
});
