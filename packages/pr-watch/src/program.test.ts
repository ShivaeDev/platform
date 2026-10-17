import { Effect } from "effect";
import { expect } from "vitest";
import { githubReplies, hasPull } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it("one long-running process discovers a later PR and stops on interruption", [], function* (h) {
	yield* h.start();
	yield* h.waitForRequest("/status");
	h.pullIs(2);
	h.openPulls(1, 2);
	yield* h.waitForRequest("sha2/status");
	h.merged(2);
	yield* h.waitForEvents(1);
	expect(h.events()[0]).toMatchObject({ event: "merged", number: 2 });
	yield* h.interrupt();
	yield* h.remainsStopped();
});
watch.it("once fails on request failure and help prints the CLI usage", [githubReplies("/pulls/1", { body: {}, status: 500 })], function* (h) {
	expect((yield* Effect.result(h.once()))._tag).toBe("Failure");
	expect(h.events()).toEqual([]);
	yield* h.help();
	expect(h.lines[0]).toContain("pr-watch --repo OWNER/REPO");
});
watch.it(
	"continuous fleet polling reloads discovered open PRs after a failed first snapshot",
	[hasPull(1, { mergeable: null, "mergeable_state": "unknown" })],
	function* (h) {
		yield* h.start();
		yield* h.waitForDiagnostic();
		h.merged(1);
		h.openPulls();
		yield* h.waitForEvents(1);
		yield* h.interrupt();
		yield* h.restart;
		expect(h.events()).toEqual([{ branch: "feature-1", event: "merged", number: 1, title: "Change 1" }]);
	},
);
watch.it("graceful interruption waits for output and snapshot replacement", [], function* (h) {
	yield* h.poll;
	h.merged(1);
	yield* h.interruptPollAt("output");
	yield* h.restart;
	expect(h.events()).toHaveLength(1);
});
