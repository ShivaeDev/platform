import { Effect } from "effect";
import { expect } from "vitest";
import { checksAre, githubReplies, hasPull, openPulls, statusIs, watchesFleet } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it(
	"fleet startup reports all already-stuck PRs and persists the baseline",
	[
		watchesFleet(),
		hasPull(1, { mergeable: false, "mergeable_state": "dirty" }),
		hasPull(2),
		statusIs(2, "failure"),
		hasPull(3, { mergeable: false, "mergeable_state": "dirty" }),
		checksAre(3, [{ conclusion: "failure", status: "completed" }]),
		hasPull(4),
		hasPull(5, { "auto_merge": null }),
		statusIs(5, "failure"),
		openPulls(1, 2, 3, 4, 5),
	],
	function* (h) {
		const state = yield* h.poll;
		expect(h.events()).toEqual([
			{ branch: "feature-1", event: "conflict", number: 1, title: "Change 1" },
			{ branch: "feature-1", event: "stuck", number: 1, title: "Change 1" },
			{ branch: "feature-2", event: "checks-failed", number: 2, title: "Change 2" },
			{ branch: "feature-2", event: "stuck", number: 2, title: "Change 2" },
			{ branch: "feature-3", event: "conflict", number: 3, title: "Change 3" },
			{ branch: "feature-3", event: "checks-failed", number: 3, title: "Change 3" },
			{ branch: "feature-3", event: "stuck", number: 3, title: "Change 3" },
		]);
		expect(Object.keys(state.prs)).toHaveLength(5);
		yield* h.poll;
		yield* h.restart;
		expect(h.events()).toHaveLength(7);
	},
);
watch.it(
	"an incomplete initial observation reports stuck only after valid evidence arrives",
	[hasPull(1, { mergeable: false, "mergeable_state": "dirty" }), githubReplies("/commits/sha1/status", { body: {}, status: 500 })],
	function* (h) {
		yield* Effect.result(h.poll);
		expect(h.events()).toEqual([]);
		h.statusIs(1, "success");
		yield* h.poll;
		expect(h.eventNames()).toEqual(["conflict", "stuck"]);
	},
);
