import { expect } from "vitest";
import { watch } from "#test/watch.ts";

for (const saved of [false, true]) {
	watch.it(
		`pending mergeability keeps the watch alive and retains ${saved ? "the previous snapshot" : "discovery-only tracking"}`,
		[],
		function* (h) {
			if (saved) {
				yield* h.poll;
			}
			const previous = yield* h.saved();
			h.pullIs(1, { "auto_merge": null, mergeable: null, "mergeable_state": "unknown" });
			yield* h.start("--interval", "60", "--heartbeat", "0");
			yield* h.waitForPollWait();
			expect(h.events()).toEqual([]);
			expect(h.diagnostics).toEqual([]);
			expect((yield* h.saved()).prs).toEqual(previous.prs);
			if (!saved) {
				expect((yield* h.saved()).openNumbers).toEqual([1]);
			}
			h.pullIs(2, { mergeable: false, "mergeable_state": "dirty" });
			h.openPulls(1, 2);
			const interval = 60_000;
			yield* h.advance(interval);
			yield* h.waitForPollWait();
			expect(h.events()).toEqual([
				{ branch: "feature-2", event: "conflict", number: 2, title: "Change 2" },
				{ branch: "feature-2", event: "stuck", number: 2, title: "Change 2" },
			]);
			expect((yield* h.saved()).prs["1"]).toEqual(previous.prs["1"]);
			h.merged(1);
			h.openPulls(2);
			yield* h.advance(interval);
			yield* h.waitForPollWait();
			expect(h.events().at(-1)).toEqual({ branch: "feature-1", event: "merged", number: 1, title: "Change 1" });
			expect(h.eventNames()).toEqual(["conflict", "stuck", "merged"]);
			expect((yield* h.saved()).prs["1"]?.merged).toBe(true);
			yield* h.interrupt();
			expect(h.events().at(-1)).toMatchObject({ event: "stopped", reason: "interrupted" });
		},
		{ clock: "test" },
	);
}
